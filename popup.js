document.addEventListener('DOMContentLoaded', function() {
    const btnPesquisar = document.getElementById('btnPesquisar');
    const btnParar = document.getElementById('btnParar');
    const nomePasta = document.getElementById('nomePasta');
    const status = document.getElementById('status');
  
    btnPesquisar.addEventListener('click', function() {
      const pasta = nomePasta.value.trim();
      
      if (!pasta) {
        updateStatus('❌ Digite o nome de uma pasta', 'error');
        nomePasta.focus();
        return;
      }
  
      // Mostra que começou a pesquisar
      updateStatus('🔍 Procurando por: ' + pasta, 'loading');
      btnPesquisar.style.display = 'none';
      btnParar.style.display = 'block';
  
      // Envia mensagem para o content script
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'iniciarPesquisa',
          nomePasta: pasta
        }, function(response) {
          if (chrome.runtime.lastError) {
            updateStatus('❌ Erro na comunicação', 'error');
            btnPesquisar.style.display = 'block';
            btnParar.style.display = 'none';
          }
        });
      });
    });
  
    btnParar.addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'pararPesquisa'
        });
      });
      
      btnPesquisar.style.display = 'block';
      btnParar.style.display = 'none';
      updateStatus('⏹️ Pesquisa parada', 'error');
    });
  
    // Enter para pesquisar
    nomePasta.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        btnPesquisar.click();
      }
    });
  
    function updateStatus(mensagem, tipo) {
      status.textContent = mensagem;
      status.className = tipo || '';
      
      // Adiciona animação para sucesso
      if (tipo === 'success') {
        status.style.animation = 'pulseSuccess 2s';
        setTimeout(() => {
          status.style.animation = '';
        }, 2000);
      }
    }
  
    // CORREÇÃO: Escuta mensagens do content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
      if (request.action === 'atualizarStatus') {
        updateStatus(request.mensagem, request.tipo);
        
        // CORREÇÃO: Mostra o botão de pesquisar novamente quando encontra
        if (request.encontrada) {
          btnPesquisar.style.display = 'block';
          btnParar.style.display = 'none';
          
          // Adiciona confetti visual para sucesso
          adicionarConfetti();
        }
      }
    });
  
    // Função para efeito de confetti visual
    function adicionarConfetti() {
      status.style.position = 'relative';
      status.style.overflow = 'hidden';
      
      for (let i = 0; i < 10; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: absolute;
          width: 6px;
          height: 6px;
          background: linear-gradient(135deg, #1a365d, #2d3748);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          animation: confetti 1s ease-out forwards;
          opacity: 0;
        `;
        
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 50;
        const delay = Math.random() * 0.5;
        
        confetti.style.setProperty('--angle', angle);
        confetti.style.setProperty('--distance', distance + 'px');
        confetti.style.animationDelay = delay + 's';
        
        status.appendChild(confetti);
        
        // Remove após animação
        setTimeout(() => {
          if (confetti.parentNode) {
            confetti.parentNode.removeChild(confetti);
          }
        }, 1500);
      }
    }
  
    // Foca no input quando abrir
    nomePasta.focus();
  });
  
  // Adiciona estilo para o confetti
  const confettiStyle = document.createElement('style');
  confettiStyle.textContent = `
    @keyframes confetti {
      0% {
        transform: translate(0, 0) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translate(
          calc(cos(var(--angle)) * var(--distance)),
          calc(sin(var(--angle)) * var(--distance))
        ) rotate(360deg);
        opacity: 0;
      }
    }
    
    @keyframes pulseSuccess {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(confettiStyle);