// Configurações Globais
const ADMIN_PASSWORD = "19762207";

// Importar módulos do Node.js para criar arquivos no computador
let fs, path, ipcRenderer;
let isElectron = false;

// Prevenção de erro ao tentar rodar via terminal (node script.js)
if (typeof document === 'undefined') {
    console.error("\n[ERRO] O arquivo 'script.js' é de Interface e precisa de um navegador/janela.");
    console.error("DICA: Abra o 'index.html' ou rode 'npm start' (se configurado com Electron).\n");
    if (typeof process !== 'undefined') process.exit(1);
}

try {
    // Verificação robusta: Só ativa o modo Electron se tiver certeza absoluta (process.versions.electron)
    if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.electron) {
        fs = require('fs');
        path = require('path');
        ipcRenderer = require('electron').ipcRenderer;
        isElectron = true;
    }
} catch (e) {
    console.log('Ambiente Web/Mobile detectado. Usando LocalStorage.');
}

let players = []; // Agora armazenará objetos: { name: "Nome", present: false }
let customTeamNames = []; // Lista de nomes personalizados para os times

let usersDB = []; // Será carregado do arquivo

// Elementos do DOM
let input, list, teamSizeInput, resultsContainer, userSession, userSessionName;
// Elementos de Login e Cadastro
let loginUserInput, loginPassInput, loginErrorMsg,
    signupUserInput, signupPassInput, signupErrorMsg,
    signupEmailInput, signupStep1, signupStep2;
// Elementos Admin
let adminPanelBtn, adminUserList, adminSearchInput,
    adminAuthEmail, adminAuthPlan, adminAuthValue,
    teamNameInput, teamNameList,
    adminPlanList, adminPlanNameInput, adminPlanValueInput, adminPlanDurationInput;

// Variável de estado
let loggedInUser = null;
let plansDB = [];
let planTypesDB = [];

// --- CONFIGURAÇÃO DO BANCO DE DADOS (ARQUIVO) ---
let dbPath; // Para jogadores
let usersDbPath; // Para usuários
let plansDbPath; // Para planos
let dataFolder; // Pasta raiz dos dados

let planTypesDbPath;

if (isElectron) {
    try {
        // Alterado para salvar na pasta 'database' dentro do próprio projeto.
        // Isso torna os dados "portáteis" para você levar ao GitHub.
        dataFolder = path.join(__dirname, 'database');

        if (!fs.existsSync(dataFolder)) {
            fs.mkdirSync(dataFolder, { recursive: true });
        }

        usersDbPath = path.join(dataFolder, 'usuarios.json');
        plansDbPath = path.join(dataFolder, 'planos.json');
        planTypesDbPath = path.join(dataFolder, 'tipos_planos.json');
    } catch (error) {
        console.error("Erro critico ao configurar pasta:", error);
        // Fallback: tenta salvar na mesma pasta do executável se o AppData falhar
        dataFolder = __dirname;
        usersDbPath = path.join(__dirname, 'usuarios_fallback.json');
        plansDbPath = path.join(__dirname, 'planos_fallback.json');
        planTypesDbPath = path.join(__dirname, 'tipos_planos_fallback.json');
    }
}

/**
 * Define o caminho do banco de dados de jogadores baseado no usuário logado
 */
function updateUserDatabasePath(username) {
    // Usamos o email (ou username original) para manter o vínculo mesmo se o admin renomear o usuário
    const safeName = username.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
    if (isElectron) {
        dbPath = path.join(dataFolder, `players_${safeName}.json`);
    } else {
        dbPath = `futapp_players_${safeName}`;
    }
}

// --- TEMA CLARO / ESCURO ---

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.innerHTML = theme === 'dark'
            ? '<i class="fas fa-sun"></i>'
            : '<i class="fas fa-moon"></i>';
        btn.title = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('futapp_theme', next);
}

window.toggleTheme = toggleTheme;

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // --- TEMA ---
    const savedTheme = localStorage.getItem('futapp_theme') || 'dark';
    applyTheme(savedTheme);

    input = document.getElementById('playerInput');
    list = document.getElementById('playerList');
    teamSizeInput = document.getElementById('teamSize');
    resultsContainer = document.getElementById('results-container');

    teamNameInput = document.getElementById('teamNameInput');
    teamNameList = document.getElementById('teamNameList');
    
    loginUserInput = document.getElementById('loginUser');
    loginPassInput = document.getElementById('loginPass');
    loginErrorMsg = document.getElementById('login-error');
    
    signupUserInput = document.getElementById('signupUser');
    signupPassInput = document.getElementById('signupPass');
    signupErrorMsg = document.getElementById('signup-error');
    signupEmailInput = document.getElementById('signupEmail');
    signupStep1 = document.getElementById('signup-step-1');
    signupStep2 = document.getElementById('signup-step-2');

    adminPanelBtn = document.getElementById('btn-admin-panel');
    adminUserList = document.getElementById('adminUserList');
    adminSearchInput = document.getElementById('adminSearchInput');
    
    adminPlanList = document.getElementById('adminPlanList');
    adminPlanNameInput = document.getElementById('adminPlanName');
    adminPlanValueInput = document.getElementById('adminPlanValue');
    adminPlanDurationInput = document.getElementById('adminPlanDuration');

    adminAuthEmail = document.getElementById('adminAuthEmail');
    adminAuthValue = document.getElementById('adminAuthValue');
    adminAuthPlan = document.getElementById('adminAuthPlan');
    
    userSession = document.getElementById('user-session');
    userSessionName = document.getElementById('user-session-name');

    // Carregar dados salvos ao abrir o app
    loadUsersDB();
    loadPlansDB();
    loadPlanTypesDB();
    // loadFromDB() removido daqui para carregar apenas após o login

    // Adicionar jogador ao pressionar Enter
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addPlayer();
    });

    // Adicionar nome de time ao pressionar Enter
    teamNameInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addTeamName();
    });

    // Login ao pressionar Enter na senha
    loginPassInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') performLogin();
    });

    // Cadastro ao pressionar Enter na senha
    signupPassInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') performSignup();
    });

    // Busca no painel admin
    adminSearchInput.addEventListener('input', (e) => {
        renderAdminUserList(e.target.value.trim());
    });
});

function performLogin() {
    const user = loginUserInput.value.trim();
    const pass = loginPassInput.value.trim();

    // Validação simulada com "Banco de Dados"
    const validUser = usersDB.find(u => u.user.toLowerCase() === user.toLowerCase() && u.pass === pass);

    loginErrorMsg.style.display = 'none';

    if (validUser) {
        loggedInUser = validUser; // Armazena o usuário logado

        // Usamos o e-mail para o caminho do BD para evitar perda de dados em caso de renomeação do username
        updateUserDatabasePath(validUser.email || validUser.user);
        loadFromDB();

        // POLÍTICA DE SEGURANÇA: Verificar data de expiração (se não for admin)
        if (validUser.role !== 'admin') {
            const now = new Date();
            const expirationDate = new Date(validUser.expiration);

            if (now > expirationDate) {
                loginErrorMsg.style.display = 'block';
                loginErrorMsg.style.color = 'var(--danger)';
                loginErrorMsg.innerHTML = `Seu acesso expirou em ${expirationDate.toLocaleDateString()}!<br>Contate o administrador para renovar.`;
                return;
            }
        }

        // Login Sucesso
        document.getElementById('screen-login').classList.add('hidden');
        document.getElementById('screen-login').classList.remove('active');

        // Mostra informações de sessão
        if (userSessionName) userSessionName.innerText = `Logado como: ${loggedInUser.user}`;
        if (userSession) userSession.classList.remove('hidden');

        // Lógica de Redirecionamento
        if (validUser.role === 'admin') {
            // Admin vai direto para o painel
            adminPanelBtn.classList.remove('hidden');
            adminPanelBtn.style.display = 'block';
            showAdminScreen();
        } else {
            // Usuário comum vai para o app normal
            document.getElementById('screen-register').classList.remove('hidden');
            document.getElementById('screen-register').classList.add('active');
            adminPanelBtn.classList.add('hidden');
            adminPanelBtn.style.display = 'none';
        }

        // Exibe informações do usuário no painel principal (se não for admin)
        const uiPanel = document.getElementById('user-info-panel');
        if (uiPanel) {
            if (validUser.role === 'admin') {
                uiPanel.classList.add('hidden');
            } else {
                uiPanel.classList.remove('hidden');
                const typeDisplay = validUser.planType || 'Mensal';
                document.getElementById('ui-plan').innerText = `${validUser.planName || 'Plano'} (${typeDisplay})`;
                document.getElementById('ui-value').innerText = `R$ ${validUser.planValue || '0,00'}`;
                document.getElementById('ui-start').innerText = validUser.createdAt ? new Date(validUser.createdAt).toLocaleDateString('pt-BR') : 'N/A';
                document.getElementById('ui-end').innerText = validUser.expiration ? new Date(validUser.expiration).toLocaleDateString('pt-BR') : 'N/A';
            }
        }

        // Esconde o texto "v2.0"
        const versionTag = document.getElementById('version-tag');
        if (versionTag) versionTag.classList.add('hidden');
    } else {
        // Login Falha
        loginErrorMsg.style.display = 'block';
        loginErrorMsg.style.color = 'var(--danger)'; // Garante que a cor seja vermelha (erro)
        loginErrorMsg.innerText = "Usuário ou senha incorretos!";
        loginPassInput.value = '';
        loginPassInput.focus();
    }
}

function logout() {
    loggedInUser = null;
    dbPath = null;
    
    // Limpa a lista de jogadores da memória e da tela
    players = [];
    customTeamNames = [];
    renderList();
    renderTeamNameList();

    // Esconde todas as telas principais e elementos de sessão
    document.querySelectorAll('section.active').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    if (userSession) userSession.classList.add('hidden');
    adminPanelBtn.classList.add('hidden');
    adminPanelBtn.style.display = 'none';
    const versionTag = document.getElementById('version-tag');
    if (versionTag) versionTag.classList.remove('hidden');
    
    // Esconde o painel de info do usuário
    const uiPanel = document.getElementById('user-info-panel');
    if (uiPanel) uiPanel.classList.add('hidden');

    // Mostra a tela de login
    document.getElementById('screen-login').classList.remove('hidden');
    document.getElementById('screen-login').classList.add('active');

    // Limpa campos
    loginUserInput.value = '';
    loginPassInput.value = '';
}

function showSignupScreen() {
    document.getElementById('screen-login').classList.remove('active');
    document.getElementById('screen-login').classList.add('hidden');
    document.getElementById('screen-signup').classList.remove('hidden');
    document.getElementById('screen-signup').classList.add('active');
    signupErrorMsg.style.display = 'none';
    // Reseta o estado do cadastro
    signupStep1.classList.remove('hidden');
    signupStep2.classList.add('hidden');
    signupEmailInput.value = '';
    signupEmailInput.focus();
}

function showLoginScreen() {
    document.getElementById('screen-signup').classList.remove('active');
    document.getElementById('screen-signup').classList.add('hidden');
    document.getElementById('screen-login').classList.remove('hidden');
    document.getElementById('screen-login').classList.add('active');
    loginErrorMsg.style.display = 'none';
    loginUserInput.focus();
}

function showAdminScreen() {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    // Esconde outras telas
    document.getElementById('screen-register').classList.add('hidden');
    document.getElementById('screen-register').classList.remove('active');
    document.getElementById('screen-admin').classList.remove('hidden');
    document.getElementById('screen-admin').classList.add('active');
    renderAdminUserList();
    renderAdminPlanList();
    renderAdminPlanTypeList();
    updatePlanDropdown();
    updatePlanTypeDropdown();
}

function backToApp() {
    // Volta para a tela principal do app (cadastro de jogadores)
    document.getElementById('screen-admin').classList.add('hidden');
    document.getElementById('screen-admin').classList.remove('active');
    document.getElementById('screen-register').classList.remove('hidden');
    document.getElementById('screen-register').classList.add('active');
}

// --- LÓGICA DE VERIFICAÇÃO DE EMAIL ---
let pendingUserIndex = -1; // Índice do usuário sendo cadastrado

window.verifySignupEmail = function() {
    const email = signupEmailInput.value.trim();
    signupErrorMsg.style.display = 'none';

    if (!email) {
        signupErrorMsg.innerText = "Por favor, digite seu e-mail.";
        signupErrorMsg.style.display = 'block';
        return;
    }

    // Procura por um usuário com este email E que esteja com status 'pending'
    const index = usersDB.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (index !== -1 && usersDB[index].role === 'pending') {
        pendingUserIndex = index;
        signupStep1.classList.add('hidden');
        signupStep2.classList.remove('hidden');
        signupUserInput.focus();
    } else if (index !== -1 && usersDB[index].role !== 'pending') {
        signupErrorMsg.innerText = "Este e-mail já possui uma conta ativa. Faça login.";
        signupErrorMsg.style.display = 'block';
    } else {
        signupErrorMsg.innerText = "E-mail não autorizado. Contate o administrador.";
        signupErrorMsg.style.display = 'block';
    }
}

function performSignup() {
    const user = signupUserInput.value.trim();
    const pass = signupPassInput.value.trim();

    signupErrorMsg.style.display = 'none';

    if (pendingUserIndex === -1) {
        signupErrorMsg.innerText = "Erro na validação. Reinicie o processo.";
        signupErrorMsg.style.display = 'block';
        return;
    }

    if (!user || !pass) {
        signupErrorMsg.innerText = "Usuário e senha não podem estar em branco.";
        signupErrorMsg.style.display = 'block';
        return;
    }

    // Verifica se o usuário já existe (ignorando maiúsculas/minúsculas)
    const userExists = usersDB.some(u => u.user.toLowerCase() === user.toLowerCase());
    if (userExists) {
        signupErrorMsg.innerText = "Este nome de usuário já está em uso.";
        signupErrorMsg.style.display = 'block';
        return;
    }

    // Atualiza o registro pendente para um usuário ativo
    usersDB[pendingUserIndex].user = user;
    usersDB[pendingUserIndex].pass = pass;
    usersDB[pendingUserIndex].role = "user"; 
    usersDB[pendingUserIndex].registeredAt = new Date().toISOString();
    
    saveUsersDB();

    // Limpa campos e volta para a tela de login suavemente
    signupUserInput.value = '';
    signupPassInput.value = '';
    signupEmailInput.value = '';
    
    showLoginScreen();

    // Preenche o usuário automaticamente e mostra mensagem de sucesso
    loginUserInput.value = user;
    loginPassInput.focus();
    loginErrorMsg.innerText = "Conta criada com sucesso!";
    loginErrorMsg.style.color = "#00ff88"; // Cor verde para sucesso
    loginErrorMsg.style.display = 'block';
}

function saveUsersDB() {
    if (isElectron) {
        try {
            fs.writeFileSync(usersDbPath, JSON.stringify(usersDB, null, 2));
        } catch (err) {
            console.error("Erro ao salvar banco de dados de usuários:", err);
            alert(`ERRO AO SALVAR USUÁRIOS!`);
        }
    } else {
        localStorage.setItem('futapp_users', JSON.stringify(usersDB));
    }
}

function savePlansDB() {
    if (isElectron) {
        try {
            fs.writeFileSync(plansDbPath, JSON.stringify(plansDB, null, 2));
        } catch (err) {
            console.error("Erro ao salvar planos:", err);
            alert(`ERRO AO SALVAR PLANOS!`);
        }
    } else {
        localStorage.setItem('futapp_plans', JSON.stringify(plansDB));
    }
}

function savePlanTypesDB() {
    if (isElectron) {
        try {
            fs.writeFileSync(planTypesDbPath, JSON.stringify(planTypesDB, null, 2));
        } catch (err) {
            console.error("Erro ao salvar tipos de planos:", err);
        }
    } else {
        localStorage.setItem('futapp_plan_types', JSON.stringify(planTypesDB));
    }
}

// --- FUNÇÕES DO PAINEL ADMIN ---

window.adminAuthorizeUser = function() {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const email = adminAuthEmail.value.trim();
    const plan = adminAuthPlan.value;
    const manualValue = adminAuthValue.value.trim();
    
    const planTypeInput = document.getElementById('adminAuthPlanType');
    const planType = planTypeInput ? planTypeInput.value : 'mensal';
    const btnAuth = document.getElementById('btn-authorize');

    if (!email) {
        alert("Preencha o e-mail.");
        return;
    }
    
    btnAuth.disabled = true;
    btnAuth.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';

    if (usersDB.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
        alert("Este e-mail já está autorizado ou cadastrado.");
        btnAuth.disabled = false;
        btnAuth.innerHTML = "Autorizar e Enviar E-mail";
        return;
    }

    const selectedPlan = plansDB.find(p => p.name === plan);
    const planValue = manualValue || (selectedPlan ? selectedPlan.value : "0,00");
    const duration = (selectedPlan ? selectedPlan.duration : 30);

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + duration);
    expDate.setHours(23, 59, 59, 999);

    const novoUsuario = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        user: "Pendente (" + email + ")",
        pass: "",
        email: email,
        role: "pending",
        planName: plan,
        planType: planType, // 'mensal' ou 'pacote'
        planValue: planValue,
        expiration: expDate.toISOString(),
        createdAt: new Date().toISOString()
    };

    usersDB.push(novoUsuario);

    saveUsersDB();

    // Dispara o e-mail via Electron IPC
    if (isElectron && ipcRenderer) {
        ipcRenderer.send('enviar-email-acesso', novoUsuario);
        ipcRenderer.once('email-enviado', (event, response) => {
            btnAuth.disabled = false;
            btnAuth.innerHTML = "Autorizar e Enviar E-mail";
            if (response.success) {
                alert(`Acesso autorizado! E-mail enviado para ${email}.`);
            } else {
                alert(`Autorizado, mas erro ao enviar e-mail: ${response.error}`);
            }
        });
    }

    renderAdminUserList(adminSearchInput.value.trim());
    adminAuthEmail.value = '';
    adminAuthValue.value = '';
    adminAuthPlan.selectedIndex = 0;
};

function renderAdminUserList(searchTerm = '') {
    // --- CÁLCULO DAS ESTATÍSTICAS ---
    const totalUsers = usersDB.filter(u => u.role !== 'admin').length;
    const activeUsers = usersDB.filter(u => u.role !== 'admin' && new Date(u.expiration) > new Date()).length;
    const totalRevenue = usersDB.reduce((acc, user) => {
        if (user.role !== 'admin' && user.planValue) {
            // Converte '15,90' para 15.90 para o cálculo
            const value = parseFloat(user.planValue.replace(',', '.'));
            if (!isNaN(value)) {
                return acc + value;
            }
        }
        return acc;
    }, 0);

    // --- RENDERIZA AS ESTATÍSTICAS NO TOPO ---
    const statsContainer = document.getElementById('admin-stats-container');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-box">
                <h4>${totalUsers}</h4><p>Total</p>
            </div>
            <div class="stat-box">
                <h4>${activeUsers}</h4><p>Ativos</p>
            </div>
            <div class="stat-box">
                <h4>R$ ${totalRevenue.toFixed(2).replace('.', ',')}</h4><p>Receita</p>
            </div>
        `;
    }

    adminUserList.innerHTML = '';

    const filteredUsers = usersDB.filter(u =>
        u.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Ordena para mostrar o admin sempre no topo
    filteredUsers.sort((a, b) => {
        if (a.role === 'admin') return -1;
        if (b.role === 'admin') return 1;
        return a.user.localeCompare(b.user);
    });

    if (filteredUsers.length === 0) {
        adminUserList.innerHTML = `<p style="text-align:center; color:#666;">${searchTerm ? 'Nenhum usuário encontrado.' : 'Nenhum usuário cadastrado.'}</p>`;
        return;
    }

    filteredUsers.forEach(user => {
        const li = document.createElement('li');
        li.className = 'admin-user-card';

        const expirationDate = new Date(user.expiration);
        const creationDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A';
        const planName = user.planName || (user.role === 'admin' ? 'Vitalício' : 'Mensal');
        const planValue = user.planValue || '0,00';
        const planTypeDisplay = user.planType || 'Mensal';
        
        const userId = user.id;
        if (!userId) return; // Proteção contra dados corrompidos
        
        let statusClass, statusText, actionsHTML;

        if (user.role === 'admin') {
            li.classList.add('admin-card'); // Estilo especial para o admin
            statusClass = 'admin';
            statusText = 'Admin';
            actionsHTML = `<div class="user-actions-placeholder">Você está gerenciando como este usuário.</div>`;
        } else if (user.role === 'pending') {
            statusClass = 'expired';
            statusText = 'Pendente';
            actionsHTML = `
                <div class="user-actions">
                    <button onclick="window.adminEditUser('${userId}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="window.adminDeleteUser('${userId}')" style="background: var(--danger); color: white;">
                        <i class="fas fa-trash"></i> Cancelar
                    </button>
                </div>`;
        } else {
            const isExpired = new Date() > expirationDate;
            statusClass = isExpired ? 'expired' : 'active';
            statusText = isExpired ? 'Expirado' : 'Ativo';
            actionsHTML = `
                <div class="user-actions">
                    <button onclick="window.adminEditUser('${userId}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="window.adminChangePassword('${userId}')" title="Alterar Senha"><i class="fas fa-key"></i></button>
                    <button onclick="window.adminDeleteUser('${userId}')" style="background: var(--danger); color: white;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        li.innerHTML = `
            <div class="user-header">
                <strong ${user.role !== 'admin' ? `onclick="window.adminEditUser('${userId}')" style="cursor:pointer; color:var(--primary)" title="Clique para editar"` : ''}><i class="fas ${user.role === 'admin' ? 'fa-crown' : (user.role === 'pending' ? 'fa-envelope' : 'fa-user')}"></i> ${user.role === 'pending' ? user.email : user.user} ${user.role !== 'admin' ? '<i class="fas fa-pen" style="font-size:0.7em; margin-left:5px;"></i>' : ''}</strong>
                <span class="user-status ${statusClass}">${statusText}</span>
            </div>
            <div class="user-details">
                <div class="user-info-row"><span>Plano:</span> <strong>${planName} (${planTypeDisplay})</strong></div>
                <div class="user-info-row"><span>E-mail:</span> <strong>${user.email || 'N/A'}</strong></div>
            </div>
            ${actionsHTML}
        `;
        adminUserList.appendChild(li);
    });
}

// --- NOVAS FUNÇÕES DE GESTÃO ---

window.adminChangePassword = function(id) {
    const user = usersDB.find(u => u.id === id);
    if (!user || user.role === 'admin') return;
    
    const newPass = prompt(`Digite a nova senha para o usuário ${user.user}:`);
    if (newPass && newPass.trim() !== "") {
        user.pass = newPass.trim();
        saveUsersDB();
        alert("Senha alterada com sucesso!");
    }
};

window.adminEditUser = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user || user.role === 'admin') return;

    if (user.role === 'pending') {
        const newEmail = prompt(`Editar e-mail pendente:`, user.email);
        if (newEmail && newEmail.trim() !== "") {
            user.email = newEmail.trim();
            user.user = "Pendente (" + user.email + ")";
        }
    } else {
        const oldName = user.user;
        const newNameInput = prompt(`Editar nome de usuário para ${oldName}:`, user.user);
        if (newNameInput !== null && newNameInput.trim() !== "" && newNameInput.trim() !== oldName) {
            const cleanName = newNameInput.trim();
            if (usersDB.some(u => u.user.toLowerCase() === cleanName.toLowerCase() && u.id !== id)) {
                alert("Este nome de usuário já está em uso.");
                return;
            }
            user.user = cleanName;
        }
        
        const newEmail = prompt(`Editar e-mail para ${user.user}:`, user.email || "");
        if (newEmail !== null && newEmail.trim() !== "") {
            user.email = newEmail.trim();
        }

        const newPass = prompt(`Editar senha (deixe vazio para não alterar):`, "");
        if (newPass && newPass.trim() !== "") {
            user.pass = newPass.trim();
        }
    }

    saveUsersDB();
    renderAdminUserList(adminSearchInput.value.trim());
}

window.adminEditPlan = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user) return;
    
    const newPlan = prompt(`Editar nome do plano para ${user.user}:`, user.planName || "Mensal");
    if (newPlan !== null && newPlan.trim() !== "") {
        user.planName = newPlan.trim();
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

window.adminEditValue = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user) return;
    
    const newValue = prompt(`Editar valor pago por ${user.user} (R$):`, user.planValue || "0,00");
    if (newValue !== null && newValue.trim() !== "") {
        user.planValue = newValue.trim();
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

window.adminEditStartDate = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user) return;
    
    const current = user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : "";
    const newVal = prompt("Nova data de início (AAAA-MM-DD):", current);
    if (newVal) {
        const d = new Date(newVal);
        if (!isNaN(d.getTime())) {
            user.createdAt = d.toISOString();
            saveUsersDB();
            renderAdminUserList(adminSearchInput.value.trim());
        }
    }
}

window.adminEditExpiration = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user) return;
    
    const current = user.expiration ? new Date(user.expiration).toISOString().split('T')[0] : "";
    const newVal = prompt("Nova data de vencimento (AAAA-MM-DD):", current);
    if (newVal) {
        const d = new Date(newVal);
        if (!isNaN(d.getTime())) {
            d.setHours(23, 59, 59, 999);
            user.expiration = d.toISOString();
            saveUsersDB();
            renderAdminUserList(adminSearchInput.value.trim());
        }
    }
}

window.adminDeleteUser = function(id) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.id === id);
    if (!user) return;
    if (confirm(`Tem certeza que deseja excluir o usuário "${user.user}"?`)) {
        const userIndex = usersDB.indexOf(user);
        if (userIndex === -1) return;
        usersDB.splice(userIndex, 1);
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
};

window.adminAddPlan = function() {
    const name = adminPlanNameInput.value.trim();
    const value = adminPlanValueInput.value.trim();
    const duration = parseInt(adminPlanDurationInput.value);

    if (!name || !value || isNaN(duration)) {
        alert("Preencha todos os campos do plano corretamente.");
        return;
    }

    plansDB.push({
        id: Date.now(),
        name,
        value,
        duration
    });

    savePlansDB();
    renderAdminPlanList();
    updatePlanDropdown();
    adminPlanNameInput.value = '';
    adminPlanValueInput.value = '';
    adminPlanDurationInput.value = '';
};

window.renderAdminPlanList = function() {
    if (!adminPlanList) return;
    adminPlanList.innerHTML = '';
    plansDB.forEach(plan => {
        const li = document.createElement('li');
        li.className = 'admin-user-card';
        li.innerHTML = `
            <div class="user-header">
                <strong><i class="fas fa-tag"></i> ${plan.name}</strong>
                <span class="user-status active">Ativo</span>
            </div>
            <div class="user-details">
                <p>Valor Padrão: <strong>R$ ${plan.value}</strong></p>
                <p>Duração Padrão: <strong>${plan.duration} dias</strong></p>
            </div>
            <div class="user-actions">
                <button onclick="adminEditPlanData(${plan.id})"><i class="fas fa-pen"></i> Editar</button>
                <button onclick="adminDeletePlan(${plan.id})" style="background: var(--danger); color: white;"><i class="fas fa-trash"></i></button>
            </div>
        `;
        adminPlanList.appendChild(li);
    });
};

window.adminEditPlanData = function(id) {
    const plan = plansDB.find(p => p.id === id);
    if (!plan) return;
    
    const newName = prompt("Editar nome do plano:", plan.name) || plan.name;
    const newValue = prompt("Editar valor (ex: 15,90):", plan.value) || plan.value;
    const newDur = prompt("Editar duração em dias:", plan.duration) || plan.duration;

    plan.name = newName;
    plan.value = newValue;
    plan.duration = parseInt(newDur);

    savePlansDB();
    renderAdminPlanList();
    updatePlanDropdown();
};

window.adminDeletePlan = function(id) {
    if (!confirm("Excluir este plano?")) return;
    plansDB = plansDB.filter(p => p.id !== id);
    savePlansDB();
    renderAdminPlanList();
    updatePlanDropdown();
};

window.adminAddPlanType = function() {
    const nameInput = document.getElementById('adminPlanTypeName');
    const name = nameInput.value.trim();
    if (!name) return;
    planTypesDB.push({ id: Date.now(), name });
    savePlanTypesDB();
    nameInput.value = '';
    renderAdminPlanTypeList();
    updatePlanTypeDropdown();
};

window.adminEditPlanType = function(id) {
    const type = planTypesDB.find(t => t.id === id);
    if (!type) return;
    const newName = prompt("Editar nome da periodicidade:", type.name);
    if (newName && newName.trim() !== "") {
        type.name = newName.trim();
        savePlanTypesDB();
        renderAdminPlanTypeList();
        updatePlanTypeDropdown();
    }
};

window.adminDeletePlanType = function(id) {
    if (!confirm("Excluir esta periodicidade?")) return;
    planTypesDB = planTypesDB.filter(t => t.id !== id);
    savePlanTypesDB();
    renderAdminPlanTypeList();
    updatePlanTypeDropdown();
};

window.renderAdminPlanTypeList = function() {
    const list = document.getElementById('adminPlanTypeList');
    if (!list) return;
    list.innerHTML = '';
    planTypesDB.forEach(type => {
        const li = document.createElement('li');
        li.className = 'admin-user-card';
        li.style.padding = '10px 16px';
        li.innerHTML = `
            <div class="user-header" style="margin-bottom:0">
                <strong><i class="fas fa-calendar-alt"></i> ${type.name}</strong>
                <div class="user-actions" style="margin-top:0">
                    <button onclick="adminEditPlanType(${type.id})" style="padding: 4px 8px"><i class="fas fa-pen"></i></button>
                    <button onclick="adminDeletePlanType(${type.id})" style="background: var(--danger); color: white; padding: 4px 8px"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });
};

window.updatePlanDropdown = function() {
    if (!adminAuthPlan) return;
    adminAuthPlan.innerHTML = plansDB.map(p => 
        `<option value="${p.name}">${p.name} (R$ ${p.value})</option>`
    ).join('');
}

window.updatePlanTypeDropdown = function() {
    const select = document.getElementById('adminAuthPlanType');
    if (!select) return;
    select.innerHTML = planTypesDB.map(t => 
        `<option value="${t.name}">${t.name}</option>`
    ).join('');
}

// Expor funções para o HTML, pois o script é carregado no body
// As funções agora são atribuídas diretamente a window durante a declaração (Refatorado acima).
// Adicionamos aqui apenas as que restam sem prefixo window. na declaração original.
window.logout = logout;
window.showAdminScreen = showAdminScreen;
window.backToApp = backToApp;
window.addTeamName = addTeamName;
window.removeTeamName = removeTeamName;
window.addPlayer = addPlayer;
window.generateTeams = generateTeams;
window.resetApp = resetApp;
function addPlayer() {
    const name = input.value.trim();
    if (name === '') return alert('Digite um nome!');
    
    // Verifica se já existe (ignorando maiúsculas/minúsculas)
    if (players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        return alert('Jogador já cadastrado!');
    }

    // Adiciona como presente por padrão ao cadastrar
    players.push({ name: name, present: true });
    saveToDB();
    input.value = '';
    renderList();
}

function removePlayer(index, event) {
    event.stopPropagation(); // Impede que o clique marque presença ao tentar excluir
    if (!confirm('Excluir este jogador permanentemente?')) return;
    
    players.splice(index, 1);
    saveToDB();
    renderList();
}

// Alterna presença (clicar no nome)
function togglePresence(index) {
    players[index].present = !players[index].present;
    saveToDB();
    renderList();
}

function resetPresence() {
    players.forEach(p => p.present = false);
    saveToDB();
    renderList();
}

// --- Funções de Banco de Dados (Arquivo Físico) ---
function saveToDB() {
    if (!loggedInUser || !dbPath) return;

    const dataToSave = {
        players: players,
        customTeamNames: customTeamNames
    };

    if (isElectron) {
        try {
            fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 2));
        } catch (err) {
            alert(`ERRO AO SALVAR!\n\nNão foi possível criar o arquivo em:\n${dbPath}\n\nVerifique se a pasta tem permissão de escrita.`);
        }
    } else {
        localStorage.setItem(dbPath, JSON.stringify(dataToSave));
    }
}

function loadPlansDB() {
    try {
        if (isElectron) {
            if (fs.existsSync(plansDbPath)) {
                const data = fs.readFileSync(plansDbPath, 'utf-8');
                plansDB = data ? JSON.parse(data) : [];
            }
        } else {
            const data = localStorage.getItem('futapp_plans');
            plansDB = data ? JSON.parse(data) : [];
        }
        if (plansDB.length === 0) {
            plansDB = [
                { id: Date.now(), name: "Mensal", value: "15,90", duration: 30 },
                { id: Date.now() + 1, name: "Crédito", value: "0,00", duration: 30 }
            ];
            savePlansDB();
        }
    } catch (error) {
        console.error("Erro ao carregar planos:", error);
        plansDB = [];
    }
}

function loadUsersDB() {
    try {
        if (isElectron) {
            if (fs.existsSync(usersDbPath)) {
                const data = fs.readFileSync(usersDbPath, 'utf-8');
                usersDB = data ? JSON.parse(data) : [];
            }
        } else {
            const data = localStorage.getItem('futapp_users');
            usersDB = data ? JSON.parse(data) : [];
        }

        // Garante admin com senha correta
        const adminIndex = usersDB.findIndex(u => u.user === 'admin');
        if (adminIndex !== -1) {
            if (usersDB[adminIndex].pass !== ADMIN_PASSWORD) {
                usersDB[adminIndex].pass = ADMIN_PASSWORD;
                saveUsersDB();
            }
        } else {
            usersDB.push({
                id: "admin-root",
                user: "admin", 
                pass: ADMIN_PASSWORD, 
                role: "admin", 
                createdAt: new Date().toISOString(), 
                expiration: "2099-12-31T23:59:59.000Z", 
                planName: "Vitalício", 
                planValue: "0,00" 
            });
            saveUsersDB();
        }

        // Migração: Garante que usuários antigos sem ID recebam um
        usersDB.forEach(u => {
            if (!u.id) u.id = Date.now() + Math.random().toString(36).substr(2, 9);
        });
        saveUsersDB();

    } catch (error) {
        console.error("Erro ao carregar banco de dados de usuários:", error);
        usersDB = [
            { user: "admin", pass: ADMIN_PASSWORD, role: "admin", createdAt: new Date().toISOString(), expiration: "2099-12-31T23:59:59.000Z", planName: "Vitalício", planValue: "0,00" }
        ];
    }
}

function loadPlanTypesDB() {
    try {
        if (isElectron) {
            if (fs.existsSync(planTypesDbPath)) {
                const data = fs.readFileSync(planTypesDbPath, 'utf-8');
                planTypesDB = data ? JSON.parse(data) : [];
            }
        } else {
            const data = localStorage.getItem('futapp_plan_types');
            planTypesDB = data ? JSON.parse(data) : [];
        }
        
        if (planTypesDB.length === 0) {
            planTypesDB = [
                { id: 1, name: "Mensal" },
                { id: 2, name: "Bimestral" },
                { id: 3, name: "Trimestral" },
                { id: 4, name: "Semestral" },
                { id: 5, name: "Anual" }
            ];
            savePlanTypesDB();
        }
    } catch (e) { console.error(e); }
}

function loadFromDB() {
    if (!loggedInUser || !dbPath) return;
    players = []; // Reseta antes de carregar

    if (isElectron) {
        if (fs.existsSync(dbPath)) {
            try {
                const data = fs.readFileSync(dbPath, 'utf-8');
                const decoded = data ? JSON.parse(data) : [];
                
                // Compatibilidade com versões anteriores (onde salvávamos apenas o array de jogadores)
                if (Array.isArray(decoded)) {
                    players = decoded;
                    customTeamNames = [];
                } else {
                    players = decoded.players || [];
                    customTeamNames = decoded.customTeamNames || [];
                }
                renderList();
                renderTeamNameList();
            } catch (error) {
                console.error("Erro ao ler banco de dados:", error);
            }
        } else {
            saveToDB(); // Cria o arquivo pela primeira vez
        }
    } else {
        const data = localStorage.getItem(dbPath);
        if (data) {
            const decoded = JSON.parse(data);
            if (Array.isArray(decoded)) {
                players = decoded;
                customTeamNames = [];
            } else {
                players = decoded.players || [];
                customTeamNames = decoded.customTeamNames || [];
            }
            renderList();
            renderTeamNameList();
        }
    }
}

function renderList() {
    const totalEl = document.getElementById('count-total');
    const presentEl = document.getElementById('count-present');
    
    // Contagem
    const total = players.length;
    const present = players.filter(p => p.present).length;
    
    if (totalEl) totalEl.innerText = total;
    if (presentEl) presentEl.innerText = present;

    // Ordena: Presentes primeiro, depois alfabético
    players.sort((a, b) => {
        if (a.present === b.present) return a.name.localeCompare(b.name);
        return a.present ? -1 : 1;
    });

    list.innerHTML = '';
    players.forEach((player, index) => {
        const li = document.createElement('li');
        
        // Adiciona estilo se estiver presente
        if (player.present) li.classList.add('present');
        
        // Evento de clique para marcar presença
        li.onclick = () => togglePresence(index);

        li.innerHTML = `
            <span><i class="fas ${player.present ? 'fa-check-circle' : 'fa-user'}"></i> ${player.name}</span>
            <button class="delete-btn" onclick="removePlayer(${index}, event)"><i class="fas fa-trash"></i></button>
        `;
        list.appendChild(li);
    });
}

function addTeamName() {
    const name = teamNameInput.value.trim();
    if (!name) return;
    customTeamNames.push(name);
    saveToDB();
    teamNameInput.value = '';
    renderTeamNameList();
}

function removeTeamName(index) {
    customTeamNames.splice(index, 1);
    saveToDB();
    renderTeamNameList();
}

function renderTeamNameList() {
    if (!teamNameList) return;
    teamNameList.innerHTML = '';
    customTeamNames.forEach((name, index) => {
        const li = document.createElement('li');
        li.style.cursor = 'default';
        li.innerHTML = `
            <span><i class="fas fa-shield-alt"></i> ${name}</span>
            <button class="delete-btn" onclick="removeTeamName(${index})"><i class="fas fa-trash"></i></button>
        `;
        teamNameList.appendChild(li);
    });
}

// Algoritmo de Embaralhamento (Fisher-Yates Shuffle)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateTeams() {
    // FILTRO: Pega apenas os jogadores marcados como PRESENTE
    const activePlayers = players.filter(p => p.present).map(p => p.name);

    if (activePlayers.length < 2) return alert('Marque pelo menos 2 jogadores na chamada!');

    let size = parseInt(teamSizeInput.value);
    
    // Proteção contra travamento: Garante tamanho mínimo de 1
    if (isNaN(size) || size < 1) {
        alert('Tamanho do time inválido. Ajustando para 5 jogadores.');
        size = 5;
        teamSizeInput.value = 5;
    }

    // 1. SORTEIO ALEATÓRIO DOS JOGADORES
    // Cria uma cópia da lista de presentes e embaralha totalmente usando o algoritmo Fisher-Yates
    const shuffled = shuffleArray([...activePlayers]); 
    const teams = [];

    // Divide a lista embaralhada em times do tamanho escolhido
    while (shuffled.length > 0) {
        teams.push(shuffled.splice(0, size));
    }

    displayResults(teams);
    
    // Troca de tela
    document.getElementById('screen-register').classList.add('hidden');
    document.getElementById('screen-register').classList.remove('active');
    document.getElementById('screen-results').classList.remove('hidden');
    document.getElementById('screen-results').classList.add('active');
}

function displayResults(teams) {
    const size = parseInt(teamSizeInput.value);
    let html = '';
    
    // Separar times completos e reservas
    const fullTeams = [];
    let reserves = [];
    let teamCounter = 1;

    teams.forEach((team) => {
        if (team.length === size) {
            const name = customTeamNames[teamCounter - 1] || `Time ${teamCounter}`;
            fullTeams.push({
                name: name,
                players: team
            });
            teamCounter++;
        } else {
            reserves.push(...team);
        }
    });
    
    // Renderizar Times
    html += `<div id="teams-view">`;
    fullTeams.forEach((team) => {
        html += `
            <div class="team-card">
                <h3>${team.name}</h3>
                <ul>
                    ${team.players.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        `;
    });

    // Renderizar Reservas
    if (reserves.length > 0) {
        html += `
            <div class="team-card reserve-card">
                <h3><i class="fas fa-user-clock"></i> Reservas (Próximos)</h3>
                <ul>
                    ${reserves.map(p => `<li>${p}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    html += `</div>`;

    // Renderizar Jogos (Confrontos)
    html += `<div id="matches-view" class="hidden">`;
    if (fullTeams.length < 2) {
        html += `<p style="text-align:center; padding:20px;">Precisa de pelo menos 2 times completos para gerar jogos.</p>`;
    } else {
        // Sorteio dos Confrontos (Embaralha a ordem dos times para os jogos)
        const matchTeams = shuffleArray([...fullTeams]);

        for (let i = 0; i < matchTeams.length; i += 2) {
            if (matchTeams[i+1]) {
                html += `
                    <div class="match-card">
                        <span>${matchTeams[i].name}</span>
                        <span class="vs">VS</span>
                        <span>${matchTeams[i+1].name}</span>
                    </div>
                `;
            } else {
                html += `
                    <div class="match-card">
                        <span>${matchTeams[i].name}</span>
                        <span class="vs">AGUARDA</span>
                        <span>(Próximo Jogo)</span>
                    </div>
                `;
            }
        }

        // Exibir reservas também na tela de confrontos para facilitar a gestão dos próximos
        if (reserves.length > 0) {
            html += `
                <div class="team-card reserve-card" style="margin-top: 15px; border-top: 4px solid #e94560;">
                    <h3><i class="fas fa-user-clock"></i> Banco de Reservas</h3>
                    <ul>${reserves.map(p => `<li>${p}</li>`).join('')}</ul>
                </div>`;
        }
    }
    html += `</div>`;

    resultsContainer.innerHTML = html;
}

function showTab(tabName) {
    const teamsView = document.getElementById('teams-view');
    const matchesView = document.getElementById('matches-view');
    const buttons = document.querySelectorAll('.tabs button');

    if (tabName === 'teams') {
        teamsView.classList.remove('hidden');
        matchesView.classList.add('hidden');
        if (buttons[0]) buttons[0].classList.add('active');
        if (buttons[1]) buttons[1].classList.remove('active');
    } else {
        teamsView.classList.add('hidden');
        matchesView.classList.remove('hidden');
        if (buttons[0]) buttons[0].classList.remove('active');
        if (buttons[1]) buttons[1].classList.add('active');
    }
}

function resetApp() {
    document.getElementById('screen-results').classList.add('hidden');
    document.getElementById('screen-results').classList.remove('active');
    document.getElementById('screen-register').classList.remove('hidden');
    document.getElementById('screen-register').classList.add('active');
}
