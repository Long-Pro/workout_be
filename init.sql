BEGIN;

CREATE TABLE users (
  id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  deleted_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE TABLE exercises (
  id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  description TEXT,
  muscle_group VARCHAR(100),
  deleted_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT exercises_pkey PRIMARY KEY (id),
  CONSTRAINT uq_exercises_normalized_name UNIQUE (normalized_name)
);

CREATE TABLE workouts (
  id UUID NOT NULL,
  user_id UUID NOT NULL,
  performed_at TIMESTAMPTZ(3) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT workouts_pkey PRIMARY KEY (id),
  CONSTRAINT workouts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE workout_exercises (
  id UUID NOT NULL,
  workout_id UUID NOT NULL,
  exercise_id UUID NOT NULL,
  "order" INTEGER NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT workout_exercises_pkey PRIMARY KEY (id),
  CONSTRAINT workout_exercises_workout_id_fkey
    FOREIGN KEY (workout_id) REFERENCES workouts (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT workout_exercises_exercise_id_fkey
    FOREIGN KEY (exercise_id) REFERENCES exercises (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_workout_exercises_workout_id_order
    UNIQUE (workout_id, "order")
);

CREATE TABLE workout_exercise_entries (
  id UUID NOT NULL,
  workout_exercise_id UUID NOT NULL,
  "order" INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  normalized_weight_kg DECIMAL(10, 3) NOT NULL,
  original_weight_value DECIMAL(10, 3) NOT NULL,
  original_weight_unit TEXT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT workout_exercise_entries_pkey PRIMARY KEY (id),
  CONSTRAINT workout_exercise_entries_workout_exercise_id_fkey
    FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT uq_workout_exercise_entries_workout_exercise_id_order
    UNIQUE (workout_exercise_id, "order")
);

CREATE INDEX idx_workouts_user_performed_id
  ON workouts (user_id, performed_at DESC, id DESC);

INSERT INTO users (id, name, created_at, updated_at)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Alice Nguyen', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'Bob Tran', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO exercises (
  id,
  name,
  normalized_name,
  description,
  muscle_group,
  created_at,
  updated_at
)
VALUES
  (
    '20000000-0000-4000-8000-000000000001',
    'Barbell Back Squat',
    'barbell-back-squat',
    'Compound lower-body exercise performed with a barbell.',
    'Legs',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Bench Press',
    'bench-press',
    'Horizontal barbell press performed on a bench.',
    'Chest',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Deadlift',
    'deadlift',
    'Compound pull from the floor.',
    'Back',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );



COMMIT;
