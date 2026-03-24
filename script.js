// Importar módulos do Node.js para criar arquivos no computador
let fs, path;
let isElectron = false;

// Prevenção de erro ao tentar rodar via terminal (node script.js)
if (typeof document === 'undefined') {
    console.error("\n[ERRO] O arquivo 'script.js' é de Interface e precisa de um navegador/janela.");
    console.error("DICA: Abra o 'index.html' ou execute o executável do aplicativo.\n");
    if (typeof process !== 'undefined') process.exit(1);
}

try {
    // Verificação robusta: Só ativa o modo Electron se tiver certeza absoluta (process.versions.electron)
    if (typeof require !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.electron) {
        fs = require('fs');
        path = require('path');
        isElectron = true;
    }
} catch (e) {
    console.log('Ambiente Web/Mobile detectado. Usando LocalStorage.');
}

let players = []; // Agora armazenará objetos: { name: "Nome", present: false }

let usersDB = []; // Será carregado do arquivo

// Elementos do DOM
let input, list, teamSizeInput, resultsContainer, userSession, userSessionName;
// Elementos de Login e Cadastro
let loginUserInput, loginPassInput, loginErrorMsg,
    signupUserInput, signupPassInput, signupErrorMsg,
    signupEmailInput, signupStep1, signupStep2;
// Elementos Admin
let adminPanelBtn, adminUserList, adminSearchInput,
    adminAuthEmail, adminAuthPlan, adminAuthDuration, adminAuthValue;

// Variável de estado
let loggedInUser = null;

// --- CONFIGURAÇÃO DO BANCO DE DADOS (ARQUIVO) ---
let dbPath; // Para jogadores
let usersDbPath; // Para usuários

if (isElectron) {
    try {
        // Tenta pegar o caminho oficial do AppData no Windows
        const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
        const dataFolder = path.join(appDataPath, 'FutApp-Data');

        // Cria a pasta se ela não existir
        if (!fs.existsSync(dataFolder)) {
            fs.mkdirSync(dataFolder, { recursive: true });
        }

        dbPath = path.join(dataFolder, 'banco_de_dados.json');
        usersDbPath = path.join(dataFolder, 'usuarios.json'); // Novo arquivo para usuários
    } catch (error) {
        console.error("Erro critico ao configurar pasta:", error);
        // Fallback: tenta salvar na mesma pasta do executável se o AppData falhar
        dbPath = path.join(__dirname, 'banco_de_dados_fallback.json');
        usersDbPath = path.join(__dirname, 'usuarios_fallback.json');
    }
}

// Inicialização quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    input = document.getElementById('playerInput');
    list = document.getElementById('playerList');
    teamSizeInput = document.getElementById('teamSize');
    resultsContainer = document.getElementById('results-container');
    
    loginUserInput = document.getElementById('loginUser');
    loginPassInput = document.getElementById('loginPass');
    loginErrorMsg = document.getElementById('login-error');
    
    signupEmailInput = document.getElementById('signupEmail');
    signupUserInput = document.getElementById('signupUser');
    signupPassInput = document.getElementById('signupPass');
    signupErrorMsg = document.getElementById('signup-error');
    signupStep1 = document.getElementById('signup-step-1');
    signupStep2 = document.getElementById('signup-step-2');

    adminPanelBtn = document.getElementById('btn-admin-panel');
    adminUserList = document.getElementById('adminUserList');
    adminSearchInput = document.getElementById('adminSearchInput');
    
    // Novos elementos Admin
    adminAuthEmail = document.getElementById('adminAuthEmail');
    adminAuthValue = document.getElementById('adminAuthValue');
    adminAuthPlan = document.getElementById('adminAuthPlan');
    adminAuthDuration = document.getElementById('adminAuthDuration');

    userSession = document.getElementById('user-session');
    userSessionName = document.getElementById('user-session-name');

    // Carregar dados salvos ao abrir o app
    loadUsersDB();
    loadFromDB();

    // Adicionar jogador ao pressionar Enter
    input.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') addPlayer();
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
        if (userSessionName) userSessionName.innerText = loggedInUser.user;
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
                document.getElementById('ui-plan').innerText = validUser.planName || 'Mensal';
                document.getElementById('ui-value').innerText = `R$ ${validUser.planValue || '0,00'}`;
                document.getElementById('ui-start').innerText = validUser.createdAt ? new Date(validUser.createdAt).toLocaleDateString('pt-BR') : 'N/A';
                document.getElementById('ui-end').innerText = validUser.expiration ? new Date(validUser.expiration).toLocaleDateString('pt-BR') : 'N/A';
            }
        }

        // Esconde o texto "v2.0"
        document.querySelector('header > p').classList.add('hidden');
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

    // Esconde todas as telas principais e elementos de sessão
    document.querySelectorAll('section.active').forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    if (userSession) userSession.classList.add('hidden');
    adminPanelBtn.classList.add('hidden');
    adminPanelBtn.style.display = 'none';
    document.querySelector('header > p').classList.remove('hidden');
    
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
    // Garante que o login sumiu
    document.getElementById('screen-login').classList.add('hidden');
    document.getElementById('screen-login').classList.remove('active');
    
    document.getElementById('screen-register').classList.add('hidden');
    document.getElementById('screen-register').classList.remove('active');
    document.getElementById('screen-admin').classList.remove('hidden');
    document.getElementById('screen-admin').classList.add('active');
    renderAdminUserList();
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

    // Procura por um usuário com este email E que esteja com status 'pending' (ou seja, autorizado mas sem cadastro)
    // OU um usuário que já tenha email mas ainda não tenha user/pass (caso de migração)
    const index = usersDB.findIndex(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (index !== -1 && usersDB[index].role === 'pending') {
        // Email encontrado e autorizado!
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

    // Verifica se o NOME DE USUÁRIO já existe
    const userExists = usersDB.some(u => u.user.toLowerCase() === user.toLowerCase());
    if (userExists) {
        signupErrorMsg.innerText = "Este nome de usuário já está em uso.";
        signupErrorMsg.style.display = 'block';
        return;
    }

    // Atualiza o registro pendente para um usuário ativo
    usersDB[pendingUserIndex].user = user;
    usersDB[pendingUserIndex].pass = pass;
    usersDB[pendingUserIndex].role = "user"; // Ativa o usuário
    usersDB[pendingUserIndex].registeredAt = new Date().toISOString();
    
    saveUsersDB();

    // Limpa campos
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

// --- FUNÇÕES DO PAINEL ADMIN ---

// Nova função: Autorizar usuário por email
window.adminAuthorizeUser = function() {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const email = adminAuthEmail.value.trim();
    const valInput = adminAuthValue.value.trim();
    const plan = adminAuthPlan.value;
    const duration = parseInt(adminAuthDuration.value);

    if (!email) {
        alert("Preencha o e-mail.");
        return;
    }

    // Verifica se e-mail já existe
    if (usersDB.some(u => u.email && u.email.toLowerCase() === email.toLowerCase())) {
        alert("Este e-mail já está autorizado ou cadastrado.");
        return;
    }

    // Calcula data de expiração automaticamente (Hoje + Dias escolhidos)
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + duration);
    expDate.setHours(23, 59, 59, 999);

    usersDB.push({
        user: "Pendente (" + email + ")", // Placeholder até o cadastro real
        pass: "",
        email: email,
        role: "pending", // Status especial
        planName: plan,
        planValue: valInput || "0,00",
        expiration: expDate.toISOString(),
        createdAt: new Date().toISOString()
    });

    saveUsersDB();
    renderAdminUserList(adminSearchInput.value.trim());
    adminAuthEmail.value = '';
    adminAuthValue.value = '';
    alert(`Acesso autorizado para ${email}! O usuário pode se cadastrar agora.`);
}

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
        u.user.toLowerCase().includes(searchTerm.toLowerCase())
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
        
        let statusClass, statusText, actionsHTML;

        if (user.role === 'admin') {
            li.classList.add('admin-card'); // Estilo especial para o admin
            statusClass = 'admin';
            statusText = 'Admin';
            actionsHTML = `<div class="user-actions-placeholder">Você está gerenciando como este usuário.</div>`;
        } else if (user.role === 'pending') {
            statusClass = 'expired'; // Usa cor de alerta ou cria nova css
            statusText = 'Pendente'; // Aguardando cadastro
            // Permite excluir convites pendentes
            actionsHTML = `<div class="user-actions"><button onclick="adminDeleteUser('${user.user}')" style="background: var(--danger); color: white;"><i class="fas fa-trash"></i> Cancelar Convite</button></div>`;
        } else {
            const isExpired = new Date() > expirationDate;
            statusClass = isExpired ? 'expired' : 'active';
            statusText = isExpired ? 'Expirado' : 'Ativo';
            actionsHTML = `
                <div class="user-actions">
                    <button onclick="adminExtendUser('${user.user}')">
                        <i class="fas fa-calendar-plus"></i> +30 Dias
                    </button>
                    <button onclick="adminDeleteUser('${user.user}')" style="background: var(--danger); color: white;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        const displayPlan = user.role === 'admin' 
            ? `<strong>${planName}</strong>`
            : `<input type="text" value="${planName}" onchange="adminUpdateUserField('${user.user}', 'planName', this.value)" style="background: rgba(255,255,255,0.1); border: 1px solid var(--secondary); color: white; padding: 2px 5px; border-radius: 4px; width: 100px;">`;
            
        const displayValue = user.role === 'admin'
            ? `<strong>R$ ${planValue}</strong>`
            : `R$ <input type="text" value="${planValue}" onchange="adminUpdateUserField('${user.user}', 'planValue', this.value)" style="background: rgba(255,255,255,0.1); border: 1px solid var(--secondary); color: white; padding: 2px 5px; border-radius: 4px; width: 80px;">`;

        li.innerHTML = `
            <div class="user-header">
                <strong><i class="fas ${user.role === 'admin' ? 'fa-crown' : (user.role === 'pending' ? 'fa-envelope' : 'fa-user')}"></i> ${user.role === 'pending' ? user.email : user.user}</strong>
                <span class="user-status ${statusClass}">${statusText}</span>
            </div>
            <div class="user-details">
                <p>Início do Plano: <strong>${creationDate}</strong></p>
                <p>Plano: ${displayPlan}</p>
                <p>Valor Pago: ${displayValue}</p>
                <p>Vencimento: <strong>${expirationDate.toLocaleDateString('pt-BR')}</strong></p>
            </div>
            ${actionsHTML}
        `;
        adminUserList.appendChild(li);
    });
}

function adminEditPlan(username) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.user === username);
    if (!user) return;
    
    const newPlan = prompt(`Editar nome do plano para ${username}:`, user.planName || "Mensal");
    if (newPlan !== null && newPlan.trim() !== "") {
        user.planName = newPlan.trim();
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

function adminEditValue(username) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.user === username);
    if (!user) return;
    
    const newValue = prompt(`Editar valor pago por ${username} (R$):`, user.planValue || "0,00");
    if (newValue !== null && newValue.trim() !== "") {
        user.planValue = newValue.trim();
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

window.adminUpdateUserField = function(username, field, newValue) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const user = usersDB.find(u => u.user === username);
    if (user) {
        user[field] = newValue.trim();
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

function adminExtendUser(username) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    const userIndex = usersDB.findIndex(u => u.user === username);
    if (userIndex === -1) return;

    // Pega a data atual do usuário e soma 30 dias
    const currentExp = new Date(usersDB[userIndex].expiration);
    // Se já estiver vencido, soma a partir de HOJE. Se não, soma a partir da data que ele já tem.
    const baseDate = (currentExp < new Date()) ? new Date() : currentExp;

    baseDate.setDate(baseDate.getDate() + 30);
    usersDB[userIndex].expiration = baseDate.toISOString();
    saveUsersDB();
    renderAdminUserList(adminSearchInput.value.trim());
}

function adminDeleteUser(username) {
    if (!loggedInUser || loggedInUser.role !== 'admin') return;
    if (confirm(`Tem certeza que deseja excluir o usuário "${username}"?`)) {
        const userIndex = usersDB.findIndex(u => u.user === username);
        if (userIndex === -1) return;
        usersDB.splice(userIndex, 1);
        saveUsersDB();
        renderAdminUserList(adminSearchInput.value.trim());
    }
}

// Expor funções para o HTML, pois o script é carregado no body
window.logout = logout;
window.showAdminScreen = showAdminScreen;
window.backToApp = backToApp;
window.adminExtendUser = adminExtendUser;
window.adminDeleteUser = adminDeleteUser;
window.adminEditPlan = adminEditPlan;
window.adminEditValue = adminEditValue;

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
    if (isElectron) {
        try {
            fs.writeFileSync(dbPath, JSON.stringify(players, null, 2));
        } catch (err) {
            alert(`ERRO AO SALVAR!\n\nNão foi possível criar o arquivo em:\n${dbPath}\n\nVerifique se a pasta tem permissão de escrita.`);
        }
    } else {
        localStorage.setItem('futapp_players', JSON.stringify(players));
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

        // Verifica se o admin existe e garante a senha correta
        const adminIndex = usersDB.findIndex(u => u.user === 'admin');
        if (adminIndex !== -1) {
            if (usersDB[adminIndex].pass !== "19762207") { // Garante senha
                usersDB[adminIndex].pass = "19762207";
                saveUsersDB();
            }
        } else {
            // Se não existe, cria
            usersDB.push({ 
                user: "admin", 
                pass: "19762207", 
                role: "admin", 
                createdAt: new Date().toISOString(), 
                expiration: "2099-12-31T23:59:59.000Z", 
                planName: "Vitalício", 
                planValue: "0,00" 
            });
            saveUsersDB();
        }
    } catch (error) {
        console.error("Erro ao carregar banco de dados de usuários:", error);
        usersDB = [
            { user: "admin", pass: "19762207", role: "admin", createdAt: new Date().toISOString(), expiration: "2099-12-31T23:59:59.000Z", planName: "Vitalício", planValue: "0,00" }
        ];
    }
}

function loadFromDB() {
    if (isElectron) {
        if (fs.existsSync(dbPath)) {
            try {
                const data = fs.readFileSync(dbPath, 'utf-8');
                players = data ? JSON.parse(data) : [];
                renderList();
            } catch (error) {
                console.error("Erro ao ler banco de dados:", error);
            }
        } else {
            saveToDB(); // Cria o arquivo pela primeira vez
        }
    } else {
        const data = localStorage.getItem('futapp_players');
        if (data) {
            players = data ? JSON.parse(data) : [];
            renderList();
        }
    }
}

function renderList() {
    // Ordena a lista alfabeticamente pelo nome
    players.sort((a, b) => a.name.localeCompare(b.name));

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
            fullTeams.push({
                name: `Time ${teamCounter++}`,
                players: team
            });
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

    if (tabName === 'teams') {
        teamsView.classList.remove('hidden');
        matchesView.classList.add('hidden');
    } else {
        teamsView.classList.add('hidden');
        matchesView.classList.remove('hidden');
    }
}

function resetApp() {
    document.getElementById('screen-results').classList.add('hidden');
    document.getElementById('screen-results').classList.remove('active');
    document.getElementById('screen-register').classList.remove('hidden');
    document.getElementById('screen-register').classList.add('active');
}
