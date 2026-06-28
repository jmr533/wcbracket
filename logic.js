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

const aliases = {
  usa: "unitedstates",
  us: "unitedstates",
  korearepublic: "southkorea",
  czechrepublic: "czechia",
  ivorycoast: "cotedivoire",
  democraticrepublicofcongo: "congodr",
  drcongo: "congodr"
};

export function normalizeTeam(value = "") {
  const normalized = value.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
  return aliases[normalized] || normalized;
}

export function roundOf32Teams(events) {
  const teams = qualifiedTeams(events);
  return teams.length === 32 ? teams.map(({ name }) => name) : [];
}

export function qualifiedTeams(events) {
  const teams = events
    .filter((event) => event.season?.slug === "round-of-32")
    .flatMap((event) => event.competitions?.[0]?.competitors || [])
    .map((competitor) => competitor.team)
    .filter((team) => team?.isActive && team.displayName)
    .map((team) => ({ name: team.displayName, flag: team.logo || "" }));
  return teams.filter((team, index) =>
    teams.findIndex((candidate) => normalizeTeam(candidate.name) === normalizeTeam(team.name)) === index
  );
}

export function knockoutMatches(entries, events) {
  const stages = new Set(["round-of-32", "round-of-16", "quarterfinals", "semifinals", "3rd-place-match", "final"]);
  return events.filter((event) => stages.has(event.season?.slug)).sort((a, b) =>
    new Date(a.date) - new Date(b.date)
  ).map((event) => {
    const competition = event.competitions?.[0] || {};
    const type = competition.status?.type || event.status?.type || {};
    return {
      id: event.id,
      stage: event.season.slug,
      date: event.date,
      state: type.state || "pre",
      completed: Boolean(type.completed),
      detail: type.shortDetail || type.detail || type.description || "Scheduled",
      clock: competition.status?.displayClock || event.status?.displayClock || "",
      sides: (competition.competitors || []).map((competitor) => {
        const team = competitor.team || {};
        const names = [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
          .map(normalizeTeam);
        const entry = entries.find((item) => names.includes(normalizeTeam(item.team)));
        return {
          team: team.isActive ? team.displayName : "TBD",
          flag: team.logo || "",
          score: competitor.score ?? "",
          winner: Boolean(competitor.winner),
          entry: entry ? { number: entry.number, player: entry.player } : null
        };
      })
    };
  });
}

export function bracketPossibilities(entries, events) {
  const rounds = [
    ["round-of-32", "Round of 32"], ["round-of-16", "Round of 16"],
    ["quarterfinals", "Quarterfinals"], ["semifinals", "Semifinals"],
    ["3rd-place-match", "Third place"], ["final", "Final"]
  ];
  const sourceStages = {
    "Round of 32": "round-of-32",
    "Round of 16": "round-of-16",
    Quarterfinal: "quarterfinals",
    Semifinal: "semifinals"
  };
  const byStage = Object.fromEntries(rounds.map(([stage]) => [stage, events
    .filter((event) => event.season?.slug === stage)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  ]));

  const entryFor = (competitor) => {
    const team = competitor?.team || {};
    const names = [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
      .map(normalizeTeam);
    return entries.find((entry) => names.includes(normalizeTeam(entry.team)));
  };
  const possibilities = (competitor) => {
    const entry = entryFor(competitor);
    if (entry) return entry.stage === "OUT" ? [] : [entry];
    const reference = competitor?.team?.displayName?.match(
      /^(Round of 32|Round of 16|Quarterfinal|Semifinal) (\d+) (Winner|Loser)$/
    );
    if (!reference) return [];
    const source = byStage[sourceStages[reference[1]]]?.[Number(reference[2]) - 1];
    const competition = source?.competitions?.[0];
    if (!competition) return [];
    const sides = competition.competitors || [];
    if (competition.status?.type?.completed) {
      return possibilities(sides.find((side) => Boolean(side.winner) === (reference[3] === "Winner")));
    }
    return sides.flatMap(possibilities);
  };

  return rounds.map(([stage, label]) => ({
    stage,
    label,
    matches: byStage[stage].map((event, index) => ({
      number: index + 1,
      date: event.date,
      sides: (event.competitions?.[0]?.competitors || []).map((side) => ({
        candidates: possibilities(side).filter((entry, candidateIndex, candidates) =>
          candidates.findIndex((candidate) => candidate.number === entry.number) === candidateIndex
        )
      }))
    }))
  }));
}

export function applyResults(entries, events) {
  const updated = entries.map((entry) => ({ ...entry }));
  const unmatched = new Set();
  let matches = 0;
  let changes = 0;
  const nextStage = {
    "round-of-32": "R16",
    "round-of-16": "QF",
    quarterfinals: "SF",
    semifinals: "FINAL",
    "3rd-place-match": "THIRD",
    final: "CHAMPION"
  };
  const loserStage = { "3rd-place-match": "FOURTH", final: "RUNNER_UP" };

  const findEntry = (competitor) => {
    const team = competitor.team;
    const names = [team.displayName, team.shortDisplayName, team.name, team.location, team.abbreviation]
      .map(normalizeTeam);
    return updated.find((entry) => names.includes(normalizeTeam(entry.team)));
  };

  [...events].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach((event) => {
    const slug = event.season?.slug;
    const competition = event.competitions?.[0];
    if (!nextStage[slug] || !competition?.status?.type?.completed) return;
    const winner = competition.competitors.find((team) => team.winner);
    const loser = competition.competitors.find((team) => !team.winner);
    if (!winner || !loser) return;
    matches++;

    [[winner, nextStage[slug]], [loser, loserStage[slug] || (slug === "semifinals" ? "SF" : "OUT")]]
      .forEach(([competitor, stage]) => {
        const entry = findEntry(competitor);
        if (!entry) {
          unmatched.add(competitor.team.displayName);
        } else if (entry.stage !== stage) {
          entry.stage = stage;
          changes++;
        }
      });
  });

  return { entries: updated, matches, changes, unmatched: [...unmatched] };
}
