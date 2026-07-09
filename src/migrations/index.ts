import * as migration_20260709_154335_initial from './20260709_154335_initial';

export const migrations = [
  {
    up: migration_20260709_154335_initial.up,
    down: migration_20260709_154335_initial.down,
    name: '20260709_154335_initial'
  },
];
