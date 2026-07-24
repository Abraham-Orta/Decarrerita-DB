const transporter = require('../config/mail');
const FROM = `"${process.env.MAIL_FROM_NAME}" <${process.env.MAIL_USER}>`;

// Common CSS constants for inline styling
const styles = {
  container: "max-width: 600px; margin: 0 auto; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);",
  header: "background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 35px 20px; text-align: center; color: #ffffff;",
  logoText: "margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -0.5px;",
  accentText: "color: #6366f1;",
  body: "padding: 40px 30px; background-color: #ffffff; color: #334155;",
  h1: "margin-top: 0; color: #1e293b; font-size: 24px; font-weight: 700;",
  p: "font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 20px;",
  footer: "background-color: #f8fafc; padding: 25px 30px; text-align: center; font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0;",
  button: "display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 15px; text-align: center; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);",
  otpContainer: "background-color: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 30px 20px; text-align: center; margin: 30px 0;",
  otpCode: "font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #6366f1; text-shadow: 1px 1px 0px rgba(0,0,0,0.05);",
  resetContainer: "background-color: #fffbeb; border: 2px dashed #fcd34d; border-radius: 12px; padding: 30px 20px; text-align: center; margin: 30px 0;",
  resetCode: "font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #f59e0b; text-shadow: 1px 1px 0px rgba(0,0,0,0.05);",
  warningText: "font-size: 14px; color: #ef4444; margin-top: 15px; font-weight: 600;",
  receiptBox: "background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px; margin-top: 25px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);",
  table: "width: 100%; border-collapse: collapse; margin-top: 10px;",
  th: "text-align: left; padding: 12px 0; border-bottom: 2px solid #f1f5f9; color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;",
  td: "text-align: left; padding: 16px 0; border-bottom: 1px solid #f1f5f9; color: #334155; font-size: 15px;",
  tdRight: "text-align: right; padding: 16px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600; font-size: 15px;",
  totalRow: "border-bottom: none; font-size: 20px; color: #10b981; font-weight: 800;",
  tripRouteItem: "margin-bottom: 12px; color: #334155; font-size: 15px; line-height: 1.4;",
  infoBadge: "display: inline-block; background-color: #f1f5f9; color: #475569; padding: 4px 10px; border-radius: 16px; font-size: 12px; font-weight: 600; margin-bottom: 15px;"
};

const getFooter = () => `
  <div style="${styles.footer}">
    <p style="margin: 0 0 8px 0; color: #475569;">¿Necesitas ayuda? Escríbenos a <strong><a href="mailto:decarrerita.sistema@gmail.com" style="color: #6366f1; text-decoration: none;">decarrerita.sistema@gmail.com</a></strong></p>
    <p style="margin: 0; font-size: 12px;">&copy; ${new Date().getFullYear()} DeCarrerita. Todos los derechos reservados.</p>
  </div>
`;

const getHeader = (title) => `
  <div style="${styles.header}">
    <h1 style="${styles.logoText}">De<span style="${styles.accentText}">Carrerita</span> 🏎️💨</h1>
    ${title ? `<p style="margin: 12px 0 0 0; font-size: 16px; color: #94a3b8; font-weight: 500;">${title}</p>` : ''}
  </div>
`;

const sendWelcomeEmail = async (to, nombre) => {
  const subject = "¡Bienvenido a DeCarrerita! 🎉";
  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('¡La familia crece!')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">¡Hola, ${nombre}! 👋</h2>
          <p style="${styles.p}">Estamos muy emocionados de tenerte en <strong>DeCarrerita</strong>. Tu cuenta ha sido creada exitosamente.</p>
          <p style="${styles.p}">Antes de que puedas empezar a disfrutar de nuestros servicios, necesitas <strong>verificar tu correo electrónico</strong> con el código de 6 dígitos que te hemos enviado por separado.</p>
          <div style="text-align: center; margin: 30px 0;">
            <p style="${styles.p} font-weight: 600; color: #10b981;">¡Prepárate para viajes seguros y rápidos! 🚀</p>
          </div>
          <p style="${styles.p}">Si tienes alguna duda, no dudes en contactarnos.</p>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

const sendLoginNotification = async (to, nombre) => {
  const subject = "Nuevo inicio de sesión en tu cuenta - DeCarrerita";
  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('Alerta de Seguridad 🛡️')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">¡Hola, ${nombre}!</h2>
          <p style="${styles.p}">Hemos detectado un nuevo inicio de sesión en tu cuenta de DeCarrerita.</p>
          <p style="${styles.p}">Fecha y hora: <strong>${new Date().toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })}</strong></p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">Si fuiste tú, puedes ignorar este mensaje. Si no reconoces esta actividad, por favor cambia tu contraseña inmediatamente.</p>
          </div>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

const sendOtpEmail = async (to, nombre, code) => {
  const subject = "Tu código de verificación - DeCarrerita";
  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('Verificación de Seguridad 🔒')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">¡Hola, ${nombre}!</h2>
          <p style="${styles.p}">Gracias por usar DeCarrerita. Para continuar con tu registro o inicio de sesión, por favor ingresa el siguiente código:</p>
          
          <div style="${styles.otpContainer}">
            <div style="${styles.otpCode}">${code}</div>
            <p style="${styles.warningText}">⏱️ Este código expira en 10 minutos.</p>
          </div>
          
          <p style="${styles.p}">Si no solicitaste este código, puedes ignorar este correo de forma segura.</p>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

const sendPasswordResetEmail = async (to, nombre, code) => {
  const subject = "Restablecimiento de contraseña - DeCarrerita";
  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('Recuperación de Cuenta 🔑')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">¡Hola, ${nombre}!</h2>
          <p style="${styles.p}">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en DeCarrerita. Usa este código para crear una nueva contraseña:</p>
          
          <div style="${styles.resetContainer}">
            <div style="${styles.resetCode}">${code}</div>
            <p style="${styles.warningText}">⏱️ Este código expira en 10 minutos.</p>
          </div>
          
          <p style="${styles.p}">Si no solicitaste un cambio de contraseña, tu cuenta está segura y puedes ignorar este correo.</p>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

const sendTripReceiptEmail = async (to, nombre, tripData) => {
  const { id_traslado, origen, destino, distancia_km, costo_total, monto_chofer, monto_empresa, fecha, choferNombre, vehiculoInfo } = tripData;
  const subject = `Recibo de tu viaje #${id_traslado} - DeCarrerita`;
  const formattedDate = new Date(fecha).toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' });
  
  const tarifaBase = (2.50).toFixed(2);
  const tarifaKm = (costo_total - 2.50).toFixed(2);

  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('Recibo de Viaje 🧾')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">¡Gracias por viajar con nosotros, ${nombre}!</h2>
          <p style="${styles.p}">Aquí tienes los detalles y el recibo de tu viaje realizado el <strong>${formattedDate}</strong>.</p>
          
          <div style="${styles.receiptBox}">
            <div style="margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px dashed #cbd5e1;">
              <div style="${styles.tripRouteItem}">
                📍 <strong>Origen:</strong> <span style="color: #64748b;">${origen}</span>
              </div>
              <div style="${styles.tripRouteItem}">
                🏁 <strong>Destino:</strong> <span style="color: #64748b;">${destino}</span>
              </div>
              <div style="margin-top: 15px;">
                <span style="${styles.infoBadge}">🛣️ ${distancia_km} km recorridos</span>
                <span style="${styles.infoBadge}">👤 Chofer: ${choferNombre}</span>
                <span style="${styles.infoBadge}">🚙 ${vehiculoInfo}</span>
              </div>
            </div>

            <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">Desglose del pago</h3>
            <table style="${styles.table}">
              <thead>
                <tr>
                  <th style="${styles.th}">Concepto</th>
                  <th style="${styles.th} text-align: right;">Monto</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="${styles.td}">Tarifa base</td>
                  <td style="${styles.tdRight}">$${tarifaBase}</td>
                </tr>
                <tr>
                  <td style="${styles.td}">Cargo por distancia (${distancia_km} km)</td>
                  <td style="${styles.tdRight}">$${tarifaKm}</td>
                </tr>
                <tr>
                  <td style="${styles.td} padding-top: 20px; color: #1e293b; font-weight: 700;">Total Cobrado</td>
                  <td style="${styles.tdRight} ${styles.totalRow} padding-top: 20px;">$${Number(costo_total).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #94a3b8; font-size: 13px;">Viaje ID: #${id_traslado}</p>
          </div>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

const sendAccountStatusEmail = async (to, nombre, activo) => {
  const subject = activo 
    ? '¡Tu cuenta ha sido reactivada! - DeCarrerita' 
    : 'Tu cuenta ha sido desactivada - DeCarrerita';
  
  const statusColor = activo ? '#10b981' : '#ef4444';
  const statusIcon = activo ? '✅' : '⚠️';
  const statusText = activo ? 'Reactivada' : 'Desactivada';
  const statusMessage = activo
    ? 'Tu cuenta ha sido reactivada por el equipo administrativo. Ya puedes volver a iniciar sesión y usar todos los servicios de DeCarrerita.'
    : 'Tu cuenta ha sido desactivada temporalmente por el equipo administrativo. Mientras tu cuenta esté inactiva, no podrás iniciar sesión ni solicitar traslados.';
  const actionMessage = activo
    ? '¡Bienvenido de vuelta! Ya puedes ingresar a tu cuenta normalmente.'
    : 'Si crees que esto es un error, por favor contáctanos para resolver la situación.';

  const html = `
    <div style="background-color: #e2e8f0; padding: 40px 20px;">
      <div style="${styles.container}">
        ${getHeader('Actualización de Cuenta')}
        <div style="${styles.body}">
          <h2 style="${styles.h1}">Hola, ${nombre}</h2>
          <p style="${styles.p}">${statusMessage}</p>
          
          <div style="background-color: ${activo ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${statusColor}; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; text-align: center;">
            <p style="margin: 0; font-size: 20px; font-weight: 700; color: ${statusColor};">${statusIcon} Cuenta ${statusText}</p>
            <p style="margin: 8px 0 0; color: #64748b; font-size: 14px;">
              Fecha: ${new Date().toLocaleString('es-VE', { dateStyle: 'long', timeStyle: 'short' })}
            </p>
          </div>
          
          <p style="${styles.p}">${actionMessage}</p>
        </div>
        ${getFooter()}
      </div>
    </div>
  `;
  return await transporter.sendMail({ from: FROM, to, subject, html });
};

module.exports = {
  sendWelcomeEmail,
  sendLoginNotification,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendTripReceiptEmail,
  sendAccountStatusEmail
};
