class Utils {
  /**
   * copy this.url to clipboard
   */
  static copy() {
    var proc = require('child_process').spawn('pbcopy')
    proc.stdin.write(this.url)
    proc.stdin.end()
  }

  /**
   * Create new File object with given data
   * @param {Object} options
   * @returns {File}
   */
  async createFile() {}

  async generate() {}
}

module.exports = Utils
