const Menu = require("../../core/Menu")

const createMenu = (app, opts) => {
  const menu = new Menu(app, opts)
  menu.name = 'primary'
  const menuElement = document.createElement('ul')
  menuElement.setAttribute('id', 'menuItems')
  menuElement.setAttribute('data-name', menu.name)

  return menu
}

module.exports = { createMenu }