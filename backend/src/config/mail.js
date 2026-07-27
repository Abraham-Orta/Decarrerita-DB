const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false, // true for 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  logger: true,
  debug: true
});

// Verify connection on startup
transporter.verify()
  .then(() => console.log('📧 Servidor de correo conectado correctamente.'))
  .catch((err) => console.error('❌ Error al conectar con el servidor de correo:', err.message));

module.exports = transporter;
