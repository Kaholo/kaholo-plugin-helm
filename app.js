const {
  bootstrap,
  helpers,
  docker,
} = require("@kaholo/plugin-library");
const { promisify } = require("util");
const exec = promisify(require("child_process").exec);

const HELM_CLI_NAME = "helm";
const HELM_IMAGE_NAME = "alpine/helm";

async function install(pluginParameters) {
  const { kubeCertificate } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
      const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
      const chartVolumeDefinition = docker.createVolumeDefinition(pluginParameters.chartDirectory);
      const volumeDefinitions = [
        certificateVolumeDefinition,
        chartVolumeDefinition,
      ];

      const authenticationParameters = generateAuthenticationParameters({
        certificateFilePath: `$${certificateVolumeDefinition.mountPoint.name}/${certificateFileName}`,
        kubeToken: pluginParameters.kubeToken,
        kubeApiServer: pluginParameters.kubeApiServer,
        kubeUser: pluginParameters.kubeUser,
      });

      const releaseNameParameters = generateReleaseNameParameters({
        releaseName: pluginParameters.releaseName,
        generateName: pluginParameters.generateName,
      });

      const installationParameters = generateInstallationParameters({
        namespace: pluginParameters.namespace,
        valuesOverride: pluginParameters.valuesOverride,
      });

      const dockerEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.mountPoint.name]: cur.mountPoint.value,
        }),
        {},
      );

      const shellEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.path.name]: cur.path.value,
        }),
        dockerEnvironmentalVariables,
      );

      const helmCommand = `\
install \
${releaseNameParameters.join(" ")} \
$${chartVolumeDefinition.mountPoint.name} \
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

      const command = docker.buildDockerCommand({
        command: helmCommand,
        image: HELM_IMAGE_NAME,
        environmentVariables: dockerEnvironmentalVariables,
        volumeDefinitionsArray: volumeDefinitions,
      });

      result = await exec(command, {
        env: shellEnvironmentalVariables,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

async function uninstall(pluginParameters) {
  const { chartName, kubeCertificate } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
      const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
      const volumeDefinitions = [
        certificateVolumeDefinition,
      ];

      const authenticationParameters = generateAuthenticationParameters({
        certificateFilePath: `$${certificateVolumeDefinition.mountPoint.name}/${certificateFileName}`,
        kubeToken: pluginParameters.kubeToken,
        kubeApiServer: pluginParameters.kubeApiServer,
        kubeUser: pluginParameters.kubeUser,
      });

      const installationParameters = generateInstallationParameters({
        namespace: pluginParameters.namespace,
      });

      const dockerEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.mountPoint.name]: cur.mountPoint.value,
        }),
        {},
      );

      const shellEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.path.name]: cur.path.value,
        }),
        dockerEnvironmentalVariables,
      );

      const helmCommand = `\
uninstall \
${chartName} \
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

      const command = docker.buildDockerCommand({
        command: helmCommand,
        image: HELM_IMAGE_NAME,
        environmentVariables: dockerEnvironmentalVariables,
        volumeDefinitionsArray: volumeDefinitions,
      });

      result = await exec(command, {
        env: shellEnvironmentalVariables,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

async function runCommand(pluginParameters) {
  const {
    kubeCertificate,
    cliCommand,
  } = pluginParameters;

  let result;

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      const [certificatePath, certificateFileName] = splitDirectory(certificateFilePath);
      const certificateVolumeDefinition = docker.createVolumeDefinition(certificatePath);
      const volumeDefinitions = [
        certificateVolumeDefinition,
      ];

      const authenticationParameters = generateAuthenticationParameters({
        certificateFilePath: `$${certificateVolumeDefinition.mountPoint.name}/${certificateFileName}`,
        kubeToken: pluginParameters.kubeToken,
        kubeApiServer: pluginParameters.kubeApiServer,
        kubeUser: pluginParameters.kubeUser,
      });

      const dockerEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.mountPoint.name]: cur.mountPoint.value,
        }),
        {},
      );

      const shellEnvironmentalVariables = volumeDefinitions.reduce(
        (acc, cur) => ({
          ...acc,
          [cur.path.name]: cur.path.value,
        }),
        dockerEnvironmentalVariables,
      );

      const helmCommand = `\
${sanitizeCommand(cliCommand)} \
${authenticationParameters.join(" ")}`;

      const command = docker.buildDockerCommand({
        command: helmCommand,
        image: HELM_IMAGE_NAME,
        environmentVariables: dockerEnvironmentalVariables,
        volumeDefinitionsArray: volumeDefinitions,
      });

      result = await exec(command, {
        env: shellEnvironmentalVariables,
      });
    },
  );

  const { stdout, stderr } = result;

  if (!stdout && stderr) {
    throw new Error(stderr);
  }

  return stdout;
}

function generateAuthenticationParameters(pluginParams) {
  const params = [];

  params.push("--kube-ca-file", pluginParams.certificateFilePath);
  params.push("--kube-token", pluginParams.kubeToken);
  params.push("--kube-apiserver", pluginParams.kubeApiServer);
  params.push("--kube-as-user", pluginParams.kubeUser);

  return params;
}

function generateReleaseNameParameters({
  releaseName,
  generateName,
}) {
  if (releaseName && generateName) {
    throw new Error("Please provide either Release Name or Generate Name parameter.");
  }

  if (!releaseName && !generateName) {
    throw new Error("Please provide Release Name or Generate Name parameter.");
  }

  const params = [];

  if (releaseName) {
    params.push(releaseName);
  }

  if (generateName) {
    params.push("--generate-name");
  }

  return params;
}

function generateInstallationParameters(pluginParams) {
  const {
    namespace,
    valuesOverrides,
  } = pluginParams;

  const params = [];

  if (namespace) {
    params.push("--namespace", namespace);
  }

  if (valuesOverrides) {
    params.push(valuesOverrides.map((override) => ["--set", override]).flat());
  }

  return params;
}

function splitDirectory(directory) {
  const pathElements = directory.split("/");

  const fileName = pathElements.pop();

  return [pathElements.join("/"), fileName];
}

// Helm Docker image accepts commands WITHOUT the CLI name
function sanitizeCommand(command) {
  return command.startsWith(HELM_CLI_NAME)
    ? command.slice(HELM_CLI_NAME.length).trim()
    : command;
}

module.exports = bootstrap({
  install,
  uninstall,
  runCommand,
});
