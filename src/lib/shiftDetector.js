/**
 * Detecta o turno atual baseado na hora do dia
 * Turnos: 1º (06-15), 2º (15-23:45), 3º (21-06)
 */
export function detectCurrentShift() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;

  // 1º Turno: 06:00 - 14:59
  if (hours >= 6 && hours < 15) {
    return { key: "primeiro", label: "1º Turno (06h–15h)", start: 360, end: 900 };
  }

  // 2º Turno: 15:00 - 23:44
  if (hours >= 15 && hours < 24) {
    return { key: "segundo", label: "2º Turno (15h–23h45)", start: 900, end: 1425 };
  }

  // 3º Turno: 21:00 - 05:59 (00:00-05:59 ou 21:00-23:59)
  if (hours >= 21 || hours < 6) {
    return { key: "terceiro", label: "3º Turno (21h–06h)", start: 1260, end: 360 };
  }

  // Padrão (nunca deve chegar aqui)
  return { key: "segundo", label: "2º Turno (15h–23h45)", start: 900, end: 1425 };
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