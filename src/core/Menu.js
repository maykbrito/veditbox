class Menu {
  name = ""
  defaults = {}
  items = []
  
  constructor(app, opts) {
    this.app = app
    this.opts = Object.assign({}, this.defaults, opts)
  }

  addItem(name, opts) {
    const menuItem = new Menu(this.app, opts)
    menuItem.name = name
    this.items.push(menuItem)
  }

  get total() {
    return this.items.length
  }

  onAddToApp() {
    this.app.menu = this

  }

  initialize() {
  }

  onAppReset(opts) {}
}

module.exports = Menu