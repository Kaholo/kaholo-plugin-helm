const fs = require('fs');
const path = require('path');

class ClusterCa{

  constructor(keyPath){
    this.keyPath = keyPath;
  }

  /**
   * 
   * @param {*} caString 
   * @returns {Promise<ClusterCa>}
   */
  static async from(caString){
    const decodedCertificate = Buffer.from(caString,'base64').toString('utf-8')

    // Write private key to file
    const keyFileName = `helm-cluster-key-${new Date().getTime()}.pem`;
    const keyPath = path.join(__dirname, keyFileName);
    return new Promise((resolve,reject)=>{
      fs.writeFile(keyPath, decodedCertificate,(err)=>{
        if (err) return reject(err);
        
        // Set key file permissions
        fs.chmod(keyPath, '0400', (error) => {
          if(error) return reject(error);
          const ca = new ClusterCa(keyPath)
          resolve(ca);
        });
      })
    });
  }

  async dispose(){
    const self = this;
    return new Promise((resolve,reject)=>{
      fs.unlink(self.keyPath,(err)=>{
        if (err) return reject(err);
        resolve();
      })
    })
  }
}

module.exports = ClusterCa;
