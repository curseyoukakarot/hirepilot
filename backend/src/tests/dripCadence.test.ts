import { dripCadence } from '../lib/dripSchedule';

test('drip schedule contains 6 emails per plan', () => {
  expect(dripCadence.free).toHaveLength(6);
  expect(dripCadence.paid).toHaveLength(6);
});

test('emails spaced correctly', () => {
  const days = dripCadence.free.map((d) => d.day);
  expect(days).toEqual([0, 2, 4, 7, 10, 14]);
});


