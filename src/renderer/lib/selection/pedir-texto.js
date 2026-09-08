// Substituto do window.prompt, que o Electron NAO implementa — ele lanca
// "prompt() is and will not be supported." e o botao morria em silencio.
//
// §10.9: index.css tem `dialog { width: 80% }`, `dialog p` e `dialog button`
// SEM layer, e regra sem layer vence @layer. Por isso este dialog usa id
// proprio e o CSS em selection.css desfaz campo a campo.
const pedirTexto = (titulo, placeholder = '') =>
  new Promise((resolve) => {
    let dlg = document.querySelector('#promptDialog')
    if (!dlg) {
      dlg = document.createElement('dialog')
      dlg.id = 'promptDialog'
      dlg.innerHTML = `
        <form method="dialog" class="prompt-form">
          <label class="prompt-titulo"></label>
          <input type="text" class="prompt-input uk-input" />
          <div class="prompt-acoes">
            <button value="ok" class="uk-btn uk-btn-primary">OK</button>
            <button value="" class="uk-btn uk-btn-ghost">Cancelar</button>
          </div>
        </form>`
      document.body.appendChild(dlg)
    }

    const input = dlg.querySelector('.prompt-input')
    dlg.querySelector('.prompt-titulo').textContent = titulo
    input.placeholder = placeholder
    input.value = ''

    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? input.value.trim() : null)

    dlg.showModal()
    input.focus()
  })

module.exports = { pedirTexto }
