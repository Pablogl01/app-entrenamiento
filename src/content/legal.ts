// Textos de privacidad, términos y ayuda. Son datos, no UI: TextPage los pinta.
// Los huecos entre corchetes los rellena Pablo antes de publicar.

export interface TextSection {
  title: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface TextDocument {
  title: string
  kicker: string
  updated: string
  intro?: string
  sections: TextSection[]
}

export const RESPONSABLE = '[Nombre y apellidos del responsable]'
export const CONTACTO = '[correo de contacto]'

export const PRIVACIDAD: TextDocument = {
  title: 'Política de privacidad',
  kicker: 'Legal',
  updated: '5 de septiembre de 2026',
  intro:
    'Esta app funciona sin cuenta y guarda todo en tu dispositivo. Solo si creas una cuenta se envían algunos datos a un servidor, y solo los necesarios para avisarte y guardar una copia. Aquí se explica cuáles, para qué y durante cuánto tiempo.',
  sections: [
    {
      title: 'Responsable',
      paragraphs: [`${RESPONSABLE}. Contacto: ${CONTACTO}.`],
    },
    {
      title: 'Qué datos se guardan en tu dispositivo',
      paragraphs: [
        'Rutinas, sesiones, series, peso corporal, ajustes y preferencias se guardan en la base de datos local del navegador (IndexedDB) y no salen de tu dispositivo salvo que actives la copia en el servidor. La preferencia de modo de color se guarda en el almacenamiento local. La app se instala en la caché del navegador para funcionar sin conexión.',
      ],
    },
    {
      title: 'Qué datos se envían al servidor si creas una cuenta',
      bullets: [
        'Correo electrónico y una derivación de tu contraseña (nunca la contraseña en claro).',
        'Zona horaria, para calcular la hora local de los avisos.',
        'Preferencias de aviso (tipo, hora, solo días programados) y la programación semanal de rutinas por nombre.',
        'Hechos del día (si te has pesado o entrenado), para no enviarte un aviso que ya no hace falta.',
        'Si activas los avisos: la suscripción push de tu navegador (una dirección técnica y dos claves que genera el propio navegador).',
        'Si activas la copia: un volcado completo de tus datos de entrenamiento. Se conservan las siete copias más recientes.',
      ],
    },
    {
      title: 'Para qué se usan',
      bullets: [
        'Mantener tu sesión abierta e identificarte al usar la app en otro dispositivo.',
        'Enviarte avisos a la hora que elijas. Solo si los activas.',
        'Guardar una copia de seguridad que puedas recuperar. Solo si la activas.',
      ],
      paragraphs: ['No se usan para publicidad, perfilado ni se ceden a terceros con fines propios.'],
    },
    {
      title: 'Base legal',
      paragraphs: [
        'La ejecución del servicio que solicitas al crear la cuenta (artículo 6.1.b del RGPD). Los avisos y la copia dependen de tu consentimiento, que das al activarlos y retiras al desactivarlos.',
      ],
    },
    {
      title: 'Cookies y almacenamiento',
      paragraphs: [
        'La app no usa cookies de análisis ni de terceros y no incluye ningún servicio externo. Al iniciar sesión, el servidor deja una única cookie técnica (rt) que mantiene tu sesión durante 90 días, solo viaja al propio servidor y se borra al cerrar sesión. Por ser estrictamente necesaria, no requiere consentimiento.',
      ],
    },
    {
      title: 'Dónde se guardan y quién los trata',
      paragraphs: [
        'El servidor y la base de datos funcionan sobre Cloudflare Workers y Cloudflare D1, que actúan como encargados del tratamiento. Los datos pueden almacenarse en centros de datos de Cloudflare en la Unión Europea o fuera de ella bajo las cláusulas contractuales tipo de la Comisión Europea.',
      ],
    },
    {
      title: 'Cuánto tiempo se conservan',
      bullets: [
        'Cuenta y preferencias: mientras la cuenta exista.',
        'Sesiones abiertas: 90 días desde el último uso, o hasta que cierres sesión.',
        'Copias de seguridad: las siete más recientes.',
        'Registro de avisos enviados e intentos de acceso: el tiempo necesario para evitar duplicados y abusos.',
      ],
    },
    {
      title: 'Tus derechos',
      paragraphs: [
        `Puedes acceder, rectificar, suprimir y exportar tus datos, así como oponerte o limitar su tratamiento, escribiendo a ${CONTACTO}. Exportar a JSON desde Ajustes te da una copia completa de tus datos locales en cualquier momento. También puedes reclamar ante la Agencia Española de Protección de Datos.`,
      ],
    },
    {
      title: 'Cambios',
      paragraphs: ['Si esta política cambia, se actualizará la fecha de arriba y, si el cambio es relevante, se avisará dentro de la app.'],
    },
  ],
}

export const TERMINOS: TextDocument = {
  title: 'Términos de uso',
  kicker: 'Legal',
  updated: '5 de septiembre de 2026',
  intro: 'Condiciones sencillas para un servicio sencillo. Al crear una cuenta las aceptas.',
  sections: [
    {
      title: 'El servicio',
      paragraphs: [
        `Esta app es un registro personal de entrenamiento y peso corporal ofrecido gratuitamente por ${RESPONSABLE}. Funciona sin cuenta. La cuenta añade avisos y copia de seguridad en el servidor.`,
      ],
    },
    {
      title: 'Tu cuenta',
      bullets: [
        'Necesitas un correo válido y una contraseña de al menos 10 caracteres. Eres responsable de mantenerla en secreto.',
        'Una cuenta por persona. No la uses para almacenar datos de otras personas sin su permiso.',
        'Puedes cerrar la sesión de un dispositivo en cualquier momento desde Ajustes. Para eliminar la cuenta y sus datos, escribe al contacto de la política de privacidad.',
      ],
    },
    {
      title: 'Uso aceptable',
      paragraphs: [
        'No intentes acceder a cuentas ajenas, saturar el servicio ni usarlo para algo distinto de registrar tu entrenamiento. Las cuentas que abusen del servicio se pueden suspender.',
      ],
    },
    {
      title: 'Sin garantías',
      paragraphs: [
        'El servicio se ofrece tal cual, sin garantía de disponibilidad ni de conservación de las copias. Guarda tus propias exportaciones. La app da información sobre tu entrenamiento, no consejo médico: consulta a un profesional antes de cambiar tu actividad física.',
      ],
    },
    {
      title: 'Cambios y ley aplicable',
      paragraphs: [
        'Estos términos pueden cambiar; la fecha de arriba indica la versión vigente. Se rigen por la legislación española.',
      ],
    },
  ],
}

export const AYUDA: TextDocument = {
  title: 'Ayuda',
  kicker: 'Preguntas frecuentes',
  updated: '5 de septiembre de 2026',
  sections: [
    {
      title: '¿Funciona sin conexión?',
      paragraphs: [
        'Sí. Todo el flujo de entrenar, registrar series y peso funciona sin red. Los datos viven en tu dispositivo. Solo los avisos y la copia en el servidor necesitan conexión.',
      ],
    },
    {
      title: '¿Necesito una cuenta?',
      paragraphs: [
        'No. Sin cuenta la app funciona igual. La cuenta sirve para que los avisos y la copia sobrevivan a reinstalar la app o cambiar de móvil, y para entrar desde otro dispositivo.',
      ],
    },
    {
      title: 'No me llegan los avisos en iPhone',
      paragraphs: [
        'En iOS los avisos solo funcionan si la app está instalada en la pantalla de inicio: Compartir, Añadir a pantalla de inicio. Una pestaña de Safari no vale. Después, en Ajustes, activa los avisos y envía uno de prueba. Si el permiso está denegado a nivel de sistema, se reactiva en los ajustes de iOS.',
      ],
    },
    {
      title: '¿Cómo hago una copia de seguridad?',
      paragraphs: [
        'En Ajustes, Gestión de datos y copia. Exportar a JSON descarga un archivo con todo. Con cuenta, Sincronizar ahora sube una copia al servidor; se guardan las siete más recientes y la app sube una al día automáticamente.',
      ],
    },
    {
      title: '¿Cómo recupero mis datos en un móvil nuevo?',
      paragraphs: ['Importa el JSON que exportaste desde Ajustes. Importar reemplaza todos los datos actuales del dispositivo.'],
    },
    {
      title: 'He olvidado la contraseña',
      paragraphs: [
        'Todavía no hay recuperación automática. Escribe al contacto de la política de privacidad desde el mismo correo de la cuenta.',
      ],
    },
    {
      title: '¿Qué es el RPE?',
      paragraphs: [
        'La percepción de esfuerzo de una serie, de 1 a 10. Un 10 es que no podías hacer ni una repetición más; un 8, que te quedaban dos. La app lo usa para estimar tu recuperación y ajustar los objetivos.',
      ],
    },
    {
      title: '¿Cómo cambio la rutina de un día?',
      paragraphs: [
        'Desde Hoy, el icono de calendario junto a Iniciar sesión abre la hoja Mover o cambiar: puedes mover el entreno a otro día, intercambiarlo, sustituir la rutina o dejar el día como descanso.',
      ],
    },
  ],
}
