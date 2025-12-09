let pesquisaAtiva = false;
let pastaProcurada = '';
let timeoutBusca;
let tentativasScroll = 0;
const MAX_TENTATIVAS_SCROLL = 50;
let velocidadeRolagem = 1.5;
let ultimoScrollHeight = 0;
let tentativasMesmaAltura = 0;
const MAX_TENTATIVAS_MESMA_ALTURA = 3;

function debugInfo() {
  console.log('=== BUSCADOR DE PASTAS - DEBUG INFO ===');
  console.log('URL atual:', window.location.href);
  console.log('Título da página:', document.title);
  console.log('Pasta procurada:', pastaProcurada);
  
  const container = encontrarContainerPrincipal();
  if (container) {
    console.log('Container encontrado:', {
      tag: container.tagName,
      classes: container.className,
      id: container.id,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      children: container.children.length
    });
  }
  
  console.log('=======================================\n');
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Mensagem recebida:', request.action);
  
  if (request.action === 'iniciarPesquisa') {
    iniciarPesquisa(request.nomePasta);
    sendResponse({success: true});
  } else if (request.action === 'pararPesquisa') {
    pararPesquisa();
    sendResponse({success: true});
  } else if (request.action === 'debug') {
    debugInfo();
    sendResponse({success: true});
  }
  return true;
});

function iniciarPesquisa(nomePasta) {
  pastaProcurada = nomePasta.toLowerCase().trim();
  pesquisaAtiva = true;
  tentativasScroll = 0;
  velocidadeRolagem = 1.5;
  ultimoScrollHeight = 0;
  tentativasMesmaAltura = 0;
  
  console.log('Iniciando pesquisa por:', pastaProcurada);
  enviarStatus(`🔍 Procurando por: "${nomePasta}"...`, 'loading');
  
  iniciarBuscaRapida();
}

function pararPesquisa() {
  pesquisaAtiva = false;
  tentativasScroll = 0;
  if (timeoutBusca) {
    clearTimeout(timeoutBusca);
  }
  enviarStatus('⏹️ Pesquisa parada', 'error');
}

function iniciarBuscaRapida() {
  if (!pesquisaAtiva) return;
  
  console.log(`=== Iniciando busca rápida ===`);
  
  verificarPastaERolar();
}

function verificarPastaERolar() {
  if (!pesquisaAtiva) return;
  
  tentativasScroll++;
  console.log(`🔄 Ciclo de busca rápida #${tentativasScroll}`);
  
  const pastaEncontrada = procurarNaPaginaAtual();
  
  if (pastaEncontrada) {
    console.log('✅ Pasta encontrada!', pastaEncontrada);
    destacarElemento(pastaEncontrada);
    enviarStatus(`✅ Pasta "${pastaProcurada}" encontrada!`, 'success', true);
    pesquisaAtiva = false;
    return;
  }
  
  if (tentativasScroll >= MAX_TENTATIVAS_SCROLL) {
    enviarStatus('❌ Limite de tentativas atingido. Pasta não encontrada.', 'error');
    pesquisaAtiva = false;
    return;
  }
  
  rolarParaBaixoRapidamente();
}

function rolarParaBaixoRapidamente() {
  if (!pesquisaAtiva) return;
  
  const scrollContainer = encontrarScrollContainer();
  if (!scrollContainer) {
    enviarStatus('❌ Não foi possível encontrar a área de lista', 'error');
    pesquisaAtiva = false;
    return;
  }
  
  const scrollHeightAtual = scrollContainer.scrollHeight;
  const scrollTopAtual = scrollContainer.scrollTop;
  const clientHeight = scrollContainer.clientHeight || window.innerHeight;
  
  const noFinal = Math.abs((scrollTopAtual + clientHeight) - scrollHeightAtual) < 50;
  
  console.log(`📊 Estado do scroll:`, {
    alturaTotal: scrollHeightAtual,
    scrollAtual: scrollTopAtual,
    alturaVisivel: clientHeight,
    noFinal: noFinal,
    velocidade: velocidadeRolagem
  });
  
  if (noFinal) {
    console.log('🏁 Chegou ao final da lista atual');
    
    if (scrollHeightAtual === ultimoScrollHeight) {
      tentativasMesmaAltura++;
      
      if (tentativasMesmaAltura >= MAX_TENTATIVAS_MESMA_ALTURA) {
        console.log('⚠️ Sem novos itens após várias tentativas');
        
        const botaoCarregarMais = encontrarBotaoCarregarMais();
        if (botaoCarregarMais) {
          console.log('📝 Clicando no botão "Carregar mais"');
          enviarStatus('📂 Carregando mais itens...', 'loading');
          botaoCarregarMais.click();
          
          timeoutBusca = setTimeout(() => {
            if (pesquisaAtiva) {
              ultimoScrollHeight = 0;
              tentativasMesmaAltura = 0;
              verificarPastaERolar();
            }
          }, 2000);
        } else {
          enviarStatus('🏁 Lista completa. Pasta não encontrada.', 'error');
          pesquisaAtiva = false;
        }
      } else {
        enviarStatus(`⏳ Aguardando carregamento... (${tentativasMesmaAltura}/${MAX_TENTATIVAS_MESMA_ALTURA})`, 'loading');
        
        timeoutBusca = setTimeout(() => {
          if (pesquisaAtiva) {
            velocidadeRolagem = 1;
            verificarPastaERolar();
          }
        }, 1500);
      }
    } else {
      console.log('🆕 Novos itens detectados! Continuando...');
      ultimoScrollHeight = scrollHeightAtual;
      tentativasMesmaAltura = 0;
      
      enviarStatus('📂 Itens carregados, verificando...', 'loading');
      
      if (scrollContainer === window) {
        window.scrollTo({ top: 0, behavior: 'instant' });
      } else {
        scrollContainer.scrollTo({ top: 0, behavior: 'instant' });
      }
      
      timeoutBusca = setTimeout(() => {
        if (pesquisaAtiva) verificarPastaERolar();
      }, 1000);
    }
  } else {
    const proximoScroll = scrollTopAtual + (clientHeight * velocidadeRolagem);
    
    enviarStatus(`🔍 Buscando... (Ciclo ${tentativasScroll})`, 'loading');
    
    if (scrollContainer === window) {
      window.scrollTo({
        top: proximoScroll,
        behavior: 'smooth'
      });
    } else {
      scrollContainer.scrollTo({
        top: proximoScroll,
        behavior: 'smooth'
      });
    }
    
    timeoutBusca = setTimeout(() => {
      if (pesquisaAtiva) {
        const novaAltura = scrollContainer.scrollHeight;
        if (novaAltura > scrollHeightAtual) {
          console.log('✨ Novos itens carregados durante rolagem!');
          ultimoScrollHeight = novaAltura;
          tentativasMesmaAltura = 0;
        }
        
        verificarPastaERolar();
      }
    }, 800);
  }
}

function procurarNaPaginaAtual() {
  const container = encontrarContainerPrincipal();
  
  if (!container) {
    console.log('❌ Container principal não encontrado');
    return null;
  }
  
  console.log(`🔍 Verificação rápida no container: ${container.tagName}.${container.className}`);
  
  const seletoresPrioritarios = [
    '[data-selection-target]',
    '[data-automationid*="Folder"]',
    '[data-automationid*="Item"]',
    '.od-ItemTile',
    '[role="gridcell"]',
    '[role="listitem"]',
    'a[href*="folder"]',
    'a[href*="id="]',
    'span',
    'div',
    'td'
  ];
  
  for (let seletor of seletoresPrioritarios) {
    try {
      const elementos = container.querySelectorAll(seletor);
      if (elementos.length > 0) {
        console.log(`🔎 Verificando ${elementos.length} elementos com "${seletor}"`);
        
        for (let i = 0; i < elementos.length; i++) {
          const elemento = elementos[i];
          const texto = elemento.textContent?.trim();
          
          if (texto && texto.length < 100) {
            const textoLower = texto.toLowerCase();
            
            if (textoLower === pastaProcurada || 
                textoLower.includes(pastaProcurada) ||
                textoLower.replace(/[^a-z0-9]/g, '') === pastaProcurada.replace(/[^a-z0-9]/g, '')) {
              console.log(`✅ Encontrado via "${seletor}": "${texto}"`);
              return elemento;
            }
          }
        }
      }
    } catch (e) {
      console.log(`⚠️ Erro no seletor ${seletor}:`, e);
    }
  }
  
  return null;
}

function encontrarContainerPrincipal() {
  const possiveisContainers = [
    '.odspSpartanList',
    '.list_c5c9bd5d',
    '.filesRoot_2ac77db3',
    '[data-is-scrollable="true"]',
    '[data-automationid="List"]',
    '[role="grid"]',
    '[role="list"]',
    'main'
  ];
  
  for (let seletor of possiveisContainers) {
    const container = document.querySelector(seletor);
    if (container) return container;
  }
  
  return document.body;
}

function encontrarScrollContainer() {
  const containerPrincipal = encontrarContainerPrincipal();
  if (containerPrincipal && containerPrincipal.scrollHeight > containerPrincipal.clientHeight) {
    return containerPrincipal;
  }
  
  return window;
}

function encontrarBotaoCarregarMais() {
  const textosBotao = ['carregar mais', 'load more', 'ver mais'];
  
  const botoes = document.querySelectorAll('button:visible, [role="button"]:visible');
  
  for (let botao of botoes) {
    const texto = botao.textContent?.toLowerCase().trim();
    if (texto) {
      for (let textoBusca of textosBotao) {
        if (texto.includes(textoBusca)) {
          return botao;
        }
      }
    }
  }
  
  return null;
}

function destacarElemento(elemento) {
  if (!elemento) return;
  
  console.log('🎯 Elemento para destacar:', {
    tag: elemento.tagName,
    classe: elemento.className,
    texto: elemento.textContent,
    html: elemento.outerHTML.substring(0, 200)
  });
  
  const destaqueAnterior = document.querySelector('.pasta-destacada');
  if (destaqueAnterior) {
    destaqueAnterior.classList.remove('pasta-destacada');
  }
  
  try {
    const textoPasta = elemento.textContent?.trim() || pastaProcurada;
    
    const selecaoAtual = window.getSelection();
    const rangeAtual = selecaoAtual.rangeCount > 0 ? selecaoAtual.getRangeAt(0) : null;
    
    const range = document.createRange();
    range.selectNodeContents(elemento);
    
    const selecao = window.getSelection();
    selecao.removeAllRanges();
    selecao.addRange(range);
    
    console.log('🔍 Simulando busca por:', textoPasta);
    
    marcarTextoNoElemento(elemento, textoPasta);
    
    selecao.removeAllRanges();
    if (rangeAtual) {
      selecao.addRange(rangeAtual);
    }
    
  } catch (e) {
    console.log('⚠️ Erro ao simular F3:', e.message);
  }
  
  elemento.classList.add('pasta-destacada');
  
  let elementoParaClicar = elemento;
  if (!elementoParaClicar.click || 
      elementoParaClicar.getAttribute('aria-disabled') === 'true' ||
      elementoParaClicar.hasAttribute('disabled')) {
    
    for (let i = 0; i < 5; i++) {
      const pai = elementoParaClicar.parentElement;
      if (!pai || pai === document.body) break;
      
      if ((pai.tagName === 'A' || pai.tagName === 'BUTTON' || 
           pai.getAttribute('role') === 'button' ||
           pai.hasAttribute('onclick') ||
           pai.hasAttribute('data-selection-invoke')) &&
          pai.getAttribute('aria-disabled') !== 'true') {
        elementoParaClicar = pai;
        break;
      }
      elementoParaClicar = pai;
    }
  }
  
  if (elementoParaClicar !== elemento) {
    elementoParaClicar.classList.add('pasta-destacada-pai');
  }
  
  setTimeout(() => {
    elemento.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'center',
      inline: 'center'
    });
    
    elemento.style.animation = 'piscarDestacado 1s 3';
    
    setTimeout(() => {
      if (pesquisaAtiva) {
        try {
          console.log('🖱️ Tentando clicar no elemento:', elementoParaClicar);
          
          if (elementoParaClicar.click && 
              elementoParaClicar.getAttribute('aria-disabled') !== 'true') {
            
            const eventoClick = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true
            });
            elementoParaClicar.dispatchEvent(eventoClick);
            
            console.log('✅ Clique simulado com sucesso');
          } else {
            const eventoKey = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true
            });
            elementoParaClicar.dispatchEvent(eventoKey);
          }
        } catch (e) {
          console.log('⚠️ Não foi possível clicar:', e.message);
        }
      }
    }, 1000);
  }, 300);
}

function marcarTextoNoElemento(elemento, texto) {
  if (!elemento || !texto) return;
  
  const textoCompleto = elemento.textContent;
  const regex = new RegExp(`(${escapeRegExp(texto)})`, 'gi');
  
  if (elemento.childNodes.length === 1 && elemento.childNodes[0].nodeType === Node.TEXT_NODE) {
    const novoHTML = textoCompleto.replace(regex, '<mark class="destacado-f3">$1</mark>');
    elemento.innerHTML = novoHTML;
  } else {
    const walker = document.createTreeWalker(
      elemento,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    const nodesParaMarcar = [];
    
    while (node = walker.nextNode()) {
      if (node.textContent.includes(texto)) {
        nodesParaMarcar.push(node);
      }
    }
    
    nodesParaMarcar.forEach(node => {
      const span = document.createElement('span');
      span.innerHTML = node.textContent.replace(regex, '<mark class="destacado-f3">$1</mark>');
      node.parentNode.replaceChild(span, node);
    });
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function enviarStatus(mensagem, tipo, encontrada = false) {
  chrome.runtime.sendMessage({
    action: 'atualizarStatus',
    mensagem: mensagem,
    tipo: tipo,
    encontrada: encontrada
  }).catch(error => {
    console.log('Erro ao enviar status:', error);
  });
}

const estiloDestaque = document.createElement('style');
estiloDestaque.textContent = `
  .pasta-destacada {
    background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%) !important;
    color: white !important;
    border: 3px solid #ffd700 !important;
    border-radius: 8px !important;
    padding: 8px 12px !important;
    box-shadow: 
      0 0 20px rgba(255, 215, 0, 0.8),
      0 0 40px rgba(26, 54, 93, 0.6),
      inset 0 0 20px rgba(255, 255, 255, 0.2) !important;
    transform: scale(1.05) !important;
    transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    position: relative !important;
    z-index: 10000 !important;
    animation: destaqueIntenso 1.5s ease-in-out !important;
    font-weight: bold !important;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5) !important;
  }
  
  .pasta-destacada-pai {
    background: linear-gradient(135deg, rgba(26, 54, 93, 0.9) 0%, rgba(45, 55, 72, 0.9) 100%) !important;
    border: 2px dashed #ffd700 !important;
    border-radius: 10px !important;
    padding: 10px !important;
    position: relative !important;
  }
  
  .destacado-f3 {
    background-color: #ffeb3b !important;
    color: #1a365d !important;
    padding: 2px 4px !important;
    border-radius: 4px !important;
    font-weight: bold !important;
    box-shadow: 0 0 8px rgba(255, 235, 59, 0.8) !important;
    animation: piscarF3 0.6s ease-in-out 3 !important;
  }
  
  @keyframes destaqueIntenso {
    0% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7);
    }
    50% {
      transform: scale(1.08);
      box-shadow: 0 0 30px 15px rgba(255, 215, 0, 0.4);
    }
    100% {
      transform: scale(1.05);
      box-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
    }
  }
  
  @keyframes piscarDestacado {
    0%, 100% {
      background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
    }
    50% {
      background: linear-gradient(135deg, #2d4d7c 0%, #3a4a63 100%);
    }
  }
  
  @keyframes piscarF3 {
    0%, 100% {
      background-color: #ffeb3b;
      transform: scale(1);
    }
    50% {
      background-color: #ffff72;
      transform: scale(1.05);
    }
  }
  
  .pasta-destacada::before {
    content: "🎯 ENCONTRADO";
    position: absolute;
    top: -25px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #1a365d 0%, #2d3748 100%);
    color: #ffd700;
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: bold;
    white-space: nowrap;
    z-index: 10001;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    border: 2px solid #ffd700;
    animation: flutuarBadge 3s ease-in-out infinite;
  }
  
  .pasta-destacada::after {
    content: '';
    position: absolute;
    top: -4px;
    left: -4px;
    right: -4px;
    bottom: -4px;
    border-radius: 12px;
    background: linear-gradient(45deg, 
      transparent, 
      transparent 20%, 
      #ffd700 50%, 
      transparent 80%, 
      transparent);
    background-size: 400% 400%;
    z-index: -1;
    animation: brilhoBorda 3s linear infinite;
    opacity: 0.8;
  }
  
  @keyframes flutuarBadge {
    0%, 100% {
      transform: translateX(-50%) translateY(0);
    }
    50% {
      transform: translateX(-50%) translateY(-5px);
    }
  }
  
  @keyframes brilhoBorda {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: 400% 50%;
    }
  }
`;

document.head.appendChild(estiloDestaque);

const observer = new MutationObserver(function(mutations) {
  if (pesquisaAtiva) {
    for (let mutation of mutations) {
      if (mutation.addedNodes.length > 5) {
        console.log('👀 Observer: muitos novos itens detectados');
        
        clearTimeout(timeoutBusca);
        timeoutBusca = setTimeout(() => {
          if (pesquisaAtiva) {
            velocidadeRolagem = Math.min(velocidadeRolagem * 1.2, 3);
            console.log(`🚀 Velocidade aumentada para: ${velocidadeRolagem}`);
            verificarPastaERolar();
          }
        }, 500);
        break;
      }
    }
  }
});

function iniciarObserver() {
  const container = encontrarContainerPrincipal();
  if (container) {
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false
    });
    console.log('👁️ Observer iniciado (otimizado)');
  } else {
    setTimeout(iniciarObserver, 1000);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarObserver);
} else {
  iniciarObserver();
}

setTimeout(debugInfo, 2000);

window.addEventListener('beforeunload', function() {
  if (timeoutBusca) clearTimeout(timeoutBusca);
  observer.disconnect();
});