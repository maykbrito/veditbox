const { ELEMENTS } = require('./elements')

// ponytail: tabs são só indicador visual do tipo ativo; controles por aba ficam pra depois
const setTab = (name) => {
  document.querySelectorAll('#menu li').forEach((li) => {
    li.classList.toggle('active', li.dataset.tab === name)
  })
}

module.exports = { setTab }
