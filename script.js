document.addEventListener('DOMContentLoaded', () => {
  // Configuração do WhatsApp da sua empresa (apenas números com DDD: 55 + DDD + Numero)
  const MY_WHATSAPP_NUMBER = '5561991221883'; 
  
  // Senha de acesso da Tela 3 (Administrador) - Você pode alterar aqui se quiser!
  const ADMIN_PASSWORD = 'admin'; 

  // Referências dos Elementos
  const screenLogin = document.getElementById('screen-login');
  const screenCard = document.getElementById('screen-card');
  const screenAdmin = document.getElementById('screen-admin');

  const formLogin = document.getElementById('form-login');
  const formStamp = document.getElementById('form-stamp');
  const btnAdminAccess = document.getElementById('btn-admin-access');
  const btnLogout = document.getElementById('btn-logout');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
  
  // Botão para apagar/reiniciar o cartão do cliente (mantendo o histórico na Tela 3)
  const btnResetClientCard = document.getElementById('btn-reset-client-card');

  const displayClientName = document.getElementById('display-client-name');
  const stampGrid = document.getElementById('stamp-grid');
  const adminLogBody = document.getElementById('admin-log-body');

  let currentUser = null;

  // Funções Auxiliares de Navegação de Tela
  function switchScreen(targetScreen) {
    [screenLogin, screenCard, screenAdmin].forEach(s => s.classList.remove('active'));
    targetScreen.classList.add('active');
  }

  // Sanitização simples contra XSS
  function sanitizeInput(str) {
    return str.replace(/[&<>"']/g, function(m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
  }

  // Obter ou Inicializar o Histórico do Administrador (Tela 3) -> NUNCA é apagado pelo cliente
  function getLogs() {
    return JSON.parse(localStorage.getItem('loyalty_logs') || '[]');
  }

  function saveLog(logEntry) {
    const logs = getLogs();
    logs.push(logEntry);
    localStorage.setItem('loyalty_logs', JSON.stringify(logs));
  }

  // Atualizar a Grid de Carimbos
  function updateStampGrid(count) {
    const slots = stampGrid.querySelectorAll('.stamp-slot');
    slots.forEach((slot, idx) => {
      if (idx < count) {
        slot.classList.add('stamped');
        slot.innerText = '';
      } else {
        slot.classList.remove('stamped');
        slot.innerText = idx + 1;
      }
    });
  }

  // 1. TELA 1 -> TELA 2 (Login do Cliente)
  formLogin.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = sanitizeInput(document.getElementById('client-name').value.trim());
    const phone = sanitizeInput(document.getElementById('client-phone').value.trim());

    if (!name || !phone) return alert('Preencha todos os campos.');

    // Salva ou recupera o estado do cliente baseado no telefone
    let clientData = JSON.parse(localStorage.getItem(`user_${phone}`)) || {
      name: name,
      phone: phone,
      stamps: 0
    };

    currentUser = clientData;
    displayClientName.innerText = `Olá, ${currentUser.name}!`;
    updateStampGrid(currentUser.stamps);
    
    // Define a data atual no input de data por padrão
    document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];

    switchScreen(screenCard);
  });

  // 2. REGISTRAR CARIMBO (TELA 2)
  formStamp.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const date = sanitizeInput(document.getElementById('purchase-date').value);
    const item = sanitizeInput(document.getElementById('purchase-item').value.trim());

    if (!date || !item) return alert('Preencha os dados da compra.');

    // Atualiza contagem (máximo 10)
    if (currentUser.stamps < 10) {
      currentUser.stamps += 1;
    } else {
      alert('Você já completou a sua cartela! Resgate o seu prêmio.');
      return;
    }

    // Salva dados do cliente no LocalStorage específico dele
    localStorage.setItem(`user_${currentUser.phone}`, JSON.stringify(currentUser));

    // Registra log exclusivo para a tela administrativa (Tela 3) -> Fica seguro e permanente lá!
    const logEntry = {
      timestamp: new Date().toLocaleString('pt-BR'),
      name: currentUser.name,
      phone: currentUser.phone,
      item: item,
      purchaseDate: date
    };
    saveLog(logEntry);

    // Atualiza interface
    updateStampGrid(currentUser.stamps);
    formStamp.reset();
    document.getElementById('purchase-date').value = new Date().toISOString().split('T')[0];

    alert(`Carimbo registrado com sucesso! Você tem ${currentUser.stamps}/10 carimbos.`);
  });

  // BOTÃO PARA ZERAR/REINICIAR CARTÃO DO CLIENTE (TELA 2)
  // Apaga os carimbos dele, mas o histórico da Tela 3 continua intacto!
  if (btnResetClientCard) {
    btnResetClientCard.addEventListener('click', () => {
      if (!currentUser) return;
      
      const confirmar = confirm('Deseja iniciar uma nova cartela? Seus carimbos atuais serão zerados.');
      if (confirmar) {
        currentUser.stamps = 0;
        localStorage.setItem(`user_${currentUser.phone}`, JSON.stringify(currentUser));
        updateStampGrid(0);
        alert('Sua cartela foi reiniciada com sucesso! 💖');
      }
    });
  }

  // COMPARTILHAR VIA WHATSAPP (TELA 2)
  btnShareWhatsapp.addEventListener('click', () => {
    if (!currentUser) return;
    
    const text = `Olá! Acabei de registrar uma compra.%0A%0A*Nome:* ${currentUser.name}%0A*Telefone:* ${currentUser.phone}%0A*Carimbos Atuais:* ${currentUser.stamps}/10`;
    const whatsappUrl = `https://wa.me/${MY_WHATSAPP_NUMBER}?text=${text}`;
    
    window.open(whatsappUrl, '_blank');
  });

  // 3. TELA 1 -> TELA 3 (Acesso Administrativo com Senha)
  btnAdminAccess.addEventListener('click', () => {
    const inputPassword = prompt('Digite a senha de administrador:');
    if (inputPassword === ADMIN_PASSWORD) {
      renderAdminLogs();
      switchScreen(screenAdmin);
    } else if (inputPassword !== null) {
      alert('Senha incorreta!');
    }
  });

  // Renderizar Registros da Tela 3 (Lendo do histórico geral seguro)
  function renderAdminLogs() {
    const logs = getLogs();
    adminLogBody.innerHTML = '';

    if (logs.length === 0) {
      adminLogBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhum registro encontrado.</td></tr>';
      return;
    }

    // Exibe os acessos e carimbos do mais recente ao mais antigo
    logs.slice().reverse().forEach(log => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${log.timestamp}</td>
        <td>${log.name}</td>
        <td>${log.phone}</td>
        <td>${log.item}</td>
        <td>${log.purchaseDate}</td>
      `;
      adminLogBody.appendChild(tr);
    });
  }

  // Logout / Voltar
  btnLogout.addEventListener('click', () => {
    currentUser = null;
    formLogin.reset();
    switchScreen(screenLogin);
  });

  btnAdminLogout.addEventListener('click', () => {
    switchScreen(screenLogin);
  });
});