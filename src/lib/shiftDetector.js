export function detectCurrentShift() {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const primeiroInicio = 6 * 60;
  const segundoInicio = 15 * 60;
  const terceiroInicio = 23 * 60 + 45;

  if (currentMinutes >= primeiroInicio && currentMinutes < segundoInicio) {
    return {
      key: "primeiro",
      label: "1º Turno",
    };
  }

  if (currentMinutes >= segundoInicio && currentMinutes < terceiroInicio) {
    return {
      key: "segundo",
      label: "2º Turno",
    };
  }

  return {
    key: "terceiro",
    label: "3º Turno",
  };
}

export const SHIFT_SCHEDULES = {
  primeiro: {
    label: "1º Turno",
    start: "06:00",
    end: "15:00",
  },
  segundo: {
    label: "2º Turno",
    start: "15:00",
    end: "23:45",
  },
  terceiro: {
    label: "3º Turno",
    start: "23:45",
    end: "06:00",
  },
};