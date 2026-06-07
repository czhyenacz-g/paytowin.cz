-- Atomická platba nájmu v bot flow.
-- Nahrazuje dvojitý Promise.all UPDATE v bot-actions.ts.
-- Oba UPDATE probíhají v jedné transakci — buď oba projdou, nebo žádný.
--
-- Záměrně NEblokuje záporné coins (závisí to na pravidlech hry, ne na DB).
-- Validuje: oba hráči existují, oba patří do stejné hry, amount > 0.
CREATE OR REPLACE FUNCTION pay_rent_atomic(
  p_game_id  uuid,
  p_payer_id uuid,
  p_owner_id uuid,
  p_amount   integer
)
RETURNS TABLE (payer_coins integer, owner_coins integer)
LANGUAGE plpgsql AS $$
DECLARE
  v_payer_coins integer;
  v_owner_coins integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'pay_rent_atomic: amount must be positive, got %', p_amount;
  END IF;

  IF p_payer_id = p_owner_id THEN
    RAISE EXCEPTION 'pay_rent_atomic: payer and owner must be different players';
  END IF;

  -- Uzamkni oba řádky ve fixním pořadí (menší UUID první) — zabrání deadlocku
  IF p_payer_id < p_owner_id THEN
    UPDATE players SET coins = coins - p_amount
      WHERE id = p_payer_id AND game_id = p_game_id
      RETURNING coins INTO v_payer_coins;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pay_rent_atomic: payer % not found in game %', p_payer_id, p_game_id;
    END IF;

    UPDATE players SET coins = coins + p_amount
      WHERE id = p_owner_id AND game_id = p_game_id
      RETURNING coins INTO v_owner_coins;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pay_rent_atomic: owner % not found in game %', p_owner_id, p_game_id;
    END IF;
  ELSE
    UPDATE players SET coins = coins + p_amount
      WHERE id = p_owner_id AND game_id = p_game_id
      RETURNING coins INTO v_owner_coins;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pay_rent_atomic: owner % not found in game %', p_owner_id, p_game_id;
    END IF;

    UPDATE players SET coins = coins - p_amount
      WHERE id = p_payer_id AND game_id = p_game_id
      RETURNING coins INTO v_payer_coins;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pay_rent_atomic: payer % not found in game %', p_payer_id, p_game_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_payer_coins, v_owner_coins;
END;
$$;
