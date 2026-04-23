// Shared, mutable UI state that needs to survive between discrete user actions
// (e.g. so we can re-render participants / results when the language changes).

export const uiState = {
  lastRanked: null,
  lastParticipants: [],
};
