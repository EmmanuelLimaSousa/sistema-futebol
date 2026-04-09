const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const nodemailer = require('nodemailer');

let mainWindow; // Variável global para manter a janela viva

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 650, // Largura ideal para o layout mobile-first
        height: 800,
        resizable: true,
        autoHideMenuBar: true, // Esconde o menu padrão (File, Edit...)
        icon: path.join(__dirname, 'icon.png'), // Opcional: se tiver um ícone
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Carrega o arquivo index.html da pasta
    mainWindow.loadFile('index.html');
}

// Configuração do E-mail (Substitua pelos seus dados SMTP)
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // Exemplo com Gmail
    port: 587,
    secure: false,
    auth: {
        user: "seu-email@gmail.com",
        pass: "sua-senha-de-app"
    }
});

ipcMain.on('enviar-email-acesso', async (event, dados) => {
    const mailOptions = {
        from: '"FutApp Gestão" <seu-email@gmail.com>',
        to: dados.email,
        subject: 'Seu Acesso ao FutApp - Instruções',
        html: `
            <div style="font-family: sans-serif; color: #333;">
                <h2>Bem-vindo ao FutApp!</h2>
                <p>Seu acesso foi autorizado pelo administrador. Utilize os dados abaixo para criar sua conta:</p>
                <hr>
                <p><strong>E-mail de Validação:</strong> ${dados.email}</p>
                <p><strong>Plano:</strong> ${dados.planName} (${dados.planType})</p>
                <p><strong>Créditos Iniciais:</strong> ${dados.credits}</p>
                <p><strong>Vencimento:</strong> ${new Date(dados.expiration).toLocaleDateString('pt-BR')}</p>
                <hr>
                <p>Abra o sistema, clique em <strong>Cadastre-se</strong> e valide seu e-mail para definir seu usuário e senha definitiva.</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        event.reply('email-enviado', { success: true });
    } catch (error) {
        event.reply('email-enviado', { success: false, error: error.message });
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});