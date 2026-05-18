/**
 * Detecta o turno atual baseado na hora do dia
 * Turnos: 1º (06-15), 2º (15-23:45), 3º (21-06)
 */
export function detectCurrentShift() {
  const now = new Date();
  const hours = now.getHours();

  // 3º Turno: 00:00 - 05:59 (vem primeiro para não ser sobreposto)
  if (hours >= 0 && hours < 6) {
    return { key: "terceiro", label: "3º Turno (22h–06h)", start: 1320, end: 360 };
  }

  // 1º Turno: 06:00 - 15:59
  if (hours >= 6 && hours < 16) {
    return { key: "primeiro", label: "1º Turno (06h–15h)", start: 360, end: 960 };
  }

  // 2º Turno: 16:00 - 23:59
  return { key: "segundo", label: "2º Turno (15h–23h)", start: 960, end: 1440 };
}

/**
 * Filtra atividades que ocorreram no turno especificado
 */
export function filterByShift(activities, shiftKey) {
  if (!Array.isArray(activities)) return [];
  
  const shiftMap = {
    primeiro: { start: 6, end: 15 },
    segundo: { start: 15, end: 24 },
    terceiro: { start: 21, endNext: 6 }, // cruza meia-noite
  };

  const shift = shiftMap[shiftKey];
  if (!shift) return activities;

  return activities.filter(activity => {
    if (!activity.turno) return false;
    return activity.turno === shiftKey;
  });
}

/**
 * Retorna dados resumidos do turno atual
 */
export function getTodayShiftData(allData, shiftKey) {
  const today = new Date().toISOString().slice(0, 10);
  return filterByShift(
    allData.filter(item => item.data === today),
    shiftKey
  );
}