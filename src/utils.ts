/**
 * Creates a promise that completes in n milliseconds.
 * @param milliseconds
 */
export const wait = <T>(milliseconds: number): Promise<T> => new Promise<T>((r) => setTimeout(r, milliseconds));

/**
 * Generates a random slug.
 *
 * @returns The slug.
 */
export const getRandomSlug = () => Math.random().toString(36).substring(2, 10);

/**
 * Gets the difference between two dates in hours.
 *
 * @param dateOne
 * @param dateTwo
 * @returns Hours
 */
export const getHoursDifference = (dateOne: Date, dateTwo: Date): number =>
    Math.abs(dateOne.getTime() - dateTwo.getTime()) / 36e5;
