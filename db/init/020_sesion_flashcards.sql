-- Mazo de flashcards (módulo de Flashcards) que se repasa dentro de una sesión de estudio.
-- Se elige al crear la sesión cuando se marca el método "Flashcards". NULL = sin mazo.
ALTER TABLE sesion_estudio
  ADD COLUMN IF NOT EXISTS id_deck INT NULL REFERENCES decks(id_deck) ON DELETE SET NULL;