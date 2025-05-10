// inspired in https://github.com/sindresorhus/p-whilst
export const whilst = async (
  condition: (actionResult: boolean) => boolean,
  action: () => Promise<unknown>,
) => {
  const loop = async (actionResult = true): Promise<unknown> => {
    if (condition(actionResult)) {
      return loop(Boolean(await action()))
    }
    return false
  }

  return loop()
}
