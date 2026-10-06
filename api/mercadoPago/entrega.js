// Cuándo se entrega un pedido: "cuanto antes" o "programado" para un día.
// Sin franja horaria: el horario se coordina por WhatsApp. Sin base de
// datos ni Express, para poder probarlo solo (ver entrega.test.js).
//
// Tiene que coincidir con utils/entrega.js en el frontend (ahí se arma el
// selector; acá es donde se rechaza de verdad una fecha que no corresponde).

// Argentina no tiene horario de verano: siempre UTC-3.
const OFFSET_ARGENTINA_MS = 3 * 60 * 60 * 1000;

// Días que abre el local, según getDay() (0 = domingo). Mismo horario que
// CONTACTO.horarioAtencion en el frontend.
export const DIAS_ABIERTO = [1, 2, 3, 4, 5, 6];

// Lo que se hornea por encargo necesita esta anticipación, en días.
export const DIAS_ENCARGO = 2;

// Hasta cuántos días para adelante se puede programar.
export const DIAS_MAXIMO = 30;

// Productos que se hornean por encargo (48 hs): las tortas ENTERAS. Es una
// torta por el nombre (no por categoría: en "Tortas" también hay brownies,
// y hay tortas en "Sin TACC" y "Vegano"), y es entera si la descripción
// no dice "(por porción)", la misma marca con la que el catálogo muestra
// la etiqueta "Por porción" (ver utils/ventaTag.js en el frontend).
export const requiereEncargo = (titulo, descripcion) =>
  /^(torta|cheesecake)\b/i.test(String(titulo || "").trim()) &&
  !/\(por porci[oó]n\)/i.test(String(descripcion || ""));

// "2026-10-06" según la hora de Argentina.
export const fechaArgentina = (ahora = new Date()) =>
  new Date(ahora.getTime() - OFFSET_ARGENTINA_MS).toISOString().slice(0, 10);

const sumarDias = (fecha, dias) => {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

const diaDeLaSemana = (fecha) => new Date(`${fecha}T00:00:00Z`).getUTCDay();

const esFechaValida = (fecha) =>
  typeof fecha === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
  !Number.isNaN(Date.parse(`${fecha}T00:00:00Z`)) &&
  // Descarta fechas que no existen ("2026-02-30" se correría al 2 de marzo).
  sumarDias(fecha, 0) === fecha;

// Valida lo que eligió el cliente. Devuelve { entrega } o { error } con un
// mensaje para mostrarle. Si no vino "cuando" (un frontend anterior a este
// cambio), no valida nada y devuelve entrega null: así el checkout viejo
// sigue andando mientras se publica el nuevo.
export const validarEntrega = ({ cuando, fecha, hayEncargo, ahora = new Date() }) => {
  if (cuando === undefined || cuando === null || cuando === "") {
    return { entrega: null };
  }

  if (cuando === "asap") {
    if (hayEncargo) {
      return {
        error: "Las tortas se encargan con 48 hs de anticipación. Elegí un día para tu pedido.",
      };
    }
    return { entrega: { cuando: "asap", fecha: "" } };
  }

  if (cuando !== "programado") {
    return { error: "Elegí cuándo querés recibir tu pedido." };
  }
  if (!esFechaValida(fecha)) {
    return { error: "La fecha de entrega no es válida." };
  }

  const hoy = fechaArgentina(ahora);
  if (fecha < sumarDias(hoy, hayEncargo ? DIAS_ENCARGO : 1)) {
    return {
      error: hayEncargo
        ? "Las tortas se encargan con 48 hs de anticipación. Elegí un día más adelante."
        : "Para hoy elegí \"Cuanto antes\", o programalo a partir de mañana.",
    };
  }
  if (fecha > sumarDias(hoy, DIAS_MAXIMO)) {
    return { error: `Podés programar tu pedido hasta ${DIAS_MAXIMO} días para adelante.` };
  }
  if (!DIAS_ABIERTO.includes(diaDeLaSemana(fecha))) {
    return { error: "Ese día el local está cerrado. Elegí otro día." };
  }

  return { entrega: { cuando: "programado", fecha } };
};

// Texto para los mails: "Cuanto antes" o "Jueves 8 de octubre (horario a
// coordinar por WhatsApp)". Vacío si el pedido no trae ese dato.
export const describirEntrega = (cuando, fecha) => {
  if (cuando === "asap") return "Cuanto antes";
  if (cuando === "programado" && esFechaValida(fecha)) {
    const texto = new Date(`${fecha}T12:00:00Z`)
      .toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .replace(",", "");
    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} (horario a coordinar por WhatsApp)`;
  }
  return "";
};
