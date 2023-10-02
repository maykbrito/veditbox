const { ELEMENTS } = require('../../utils/elements')

ELEMENTS.helpBtn.onclick = () => ELEMENTS.modal.showModal()
ELEMENTS.closeBtn.onclick = () => ELEMENTS.modal.close()