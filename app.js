const child_process = require('child_process');
const ClusterCa = require("./cluster-ca");

async function execCommand(command){
  return new Promise((resolve,reject) => {
		child_process.exec(command, (error, stdout, stderr) => {
			if (error) {
				return reject(error);
			}
			return resolve(stdout);
		});
	})
}

async function helmInstall(action, settings){
  const caCert = action.params.caCert;
  const endpointUrl = action.params.endpointUrl;
  const token = action.params.token;
  const saName = action.params.saName;
  const chartName = action.params.chart;
  const generateName = action.params.generateName && action.params.generateName!=="false";
  const dirPath = action.params.dirPath;
  const namesapce = action.params.namesapce;
  const helmVars = action.params.helmVars;

  const cmdOptions = []

  let helmCmdCluster;
  let clusterCa;
  
  if(caCert && endpointUrl && token && saName){
    clusterCa = await ClusterCa.from(caCert);
    helmCmdCluster = `--kube-apiserver ${endpointUrl} --kube-ca-file ${clusterCa.keyPath} --kube-as-user ${saName} --kube-token ${token}`
  } else if (caCert || endpointUrl || token || saName){
    throw "Partial credentials supllied";
  }

  if(dirPath){
    cmdOptions.push(`${dirPath}`);
  }
  
  if(generateName){
    cmdOptions.push(`--generate-name`);
  }
  
  if(namesapce){
    cmdOptions.push(`-n ${namesapce} --create-namespace`);
  }


  cmdOptions.push(helmCmdCluster);

  if(helmVars){
    let varsArray = (typeof helmVars=='string') ? helmVars.split('\n') : helmVars;
    varsArray.forEach(helmVar=>{
      cmdOptions.push(`--set ${helmVar}`);
    })
  }

  const helmCmd = `helm upgrade --install ${chartName} ${cmdOptions.join(' ')}`
  try{
    return await execCommand(helmCmd);
  } catch (err){
    throw err;
  } finally{
    try{
      if (clusterCa){
        await clusterCa.dispose();
      }
    } catch (err){}
  }
}

module.exports = {
  helmInstall,
};