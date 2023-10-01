const modal = document.querySelector('dialog')
helpBtn.onclick = () => modal.showModal()

const closeBtn = modal.querySelector('button')
closeBtn.onclick = () => modal.close()