export const SHIFT_SCHEDULES = {
  primeiro: {
    key: "primeiro",
    label: "1º Turno",
    start: "06:00",
    end: "15:00",
    horas: ["06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
  },
  segundo: {
    key: "segundo",
    label: "2º Turno",
    start: "15:00",
    end: "23:45",
    horas: ["15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00", "23:45"],
  },
  terceiro: {
    key: "terceiro",
    label: "3º Turno",
    start: "23:45",
    end: "06:00",
    horas: ["23:45", "00:00", "01:00", "02:00", "03:00", "04:00", "05:00", "06:00"],
  },
};

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatDateToInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function detectCurrentShift() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const primeiroInicio = timeToMinutes("06:00");
  const segundoInicio = timeToMinutes("15:00");
  const terceiroInicio = timeToMinutes("23:45");

  if (currentMinutes >= primeiroInicio && currentMinutes < segundoInicio) {
    return SHIFT_SCHEDULES.primeiro;
  }

  if (currentMinutes >= segundoInicio && currentMinutes < terceiroInicio) {
    return SHIFT_SCHEDULES.segundo;
  }

  return SHIFT_SCHEDULES.terceiro;
}

export function getCurrentShift() {
  return detectCurrentShift();
}

export function getShiftByKey(key) {
  return SHIFT_SCHEDULES[key] || SHIFT_SCHEDULES.segundo;
}

export function getShiftHours(key) {
  return getShiftByKey(key).horas;
}

export function getTodayShiftData() {
  const today = new Date();
  const currentShift = detectCurrentShift();

  return {
    date: formatDateToInput(today),
    data: formatDateToInput(today),
    turno: currentShift.key,
    key: currentShift.key,
    label: currentShift.label,
    start: currentShift.start,
    end: currentShift.end,
    horas: currentShift.horas,
    shift: currentShift,
  };
}

export function isCurrentShift(key) {
  return detectCurrentShift().key === key;
}

export function getShiftLabel(key) {
  return getShiftByKey(key).label;
}