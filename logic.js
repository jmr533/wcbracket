export function parseTeams(value) {
  const teams = value.split("\n").map((team) => team.trim()).filter(Boolean);
  if (teams.length !== 32) return { teams, error: "Exactly 32 required" };
  if (new Set(teams.map((team) => team.toLocaleLowerCase())).size !== 32) {
    return { teams, error: "Team names must be unique" };
  }
  return { teams, error: "" };
}

export function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const target = Math.floor(random[0] / (2 ** 32) * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
