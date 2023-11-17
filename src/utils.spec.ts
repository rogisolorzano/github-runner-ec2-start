import { getHoursDifference } from './utils';

describe('getHoursDifference', () => {
  test('it should subtract dates correctly', () => {
    expect(getHoursDifference(new Date('2022-02-16T03:53:00.000Z'), new Date('2022-02-16T04:53:00.000Z'))).toEqual(1);
    expect(getHoursDifference(new Date('2022-02-16T04:53:00.000Z'), new Date('2022-02-16T03:53:00.000Z'))).toEqual(1);
    expect(
      getHoursDifference(new Date('2022-02-16T04:55:00.000Z'), new Date('2022-02-16T03:53:00.000Z'))
    ).toBeGreaterThan(1);
    expect(
      getHoursDifference(new Date('2022-02-16T03:53:00.000Z'), new Date('2022-02-16T09:55:00.000Z'))
    ).toBeGreaterThan(5);
  });
});
