const {
  chmod,
  unlink,
  writeFile,
} = require("fs/promises");
const path = require("path");

class ClusterCa {
  constructor(keyPath) {
    this.keyPath = keyPath;
  }

  /**
   *
   * @param {*} caString
   * @returns {Promise<ClusterCa>}
   */
  static async from(caString) {
    const decodedCertificate = Buffer.from(caString, "base64").toString("utf-8");

    // Write private key to file
    const keyFileName = `helm-cluster-key-${new Date().getTime()}.pem`;
    const keyPath = path.join(__dirname, keyFileName);

    await writeFile(keyPath, decodedCertificate);

    await chmod(keyPath, "0400");

    return new ClusterCa(keyPath);
  }

  async dispose() {
    return unlink(this.keyPath);
  }
}

module.exports = ClusterCa;
