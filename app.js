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

  await helpers.temporaryFileSentinel(
    [kubeCertificate],
    async (certificateFilePath) => {
      const authenticationParameters = generateAuthenticationParameters({
        certificateFilePath,
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

      const volumeDefinition = docker.createVolumeDefinition(pluginParameters.chartDirectory);

      const environmentalVariables = {
        [volumeDefinition.mountPoint.name]: volumeDefinition.mountPoint.value,
      };

      const helmCommand = `\
install \
${releaseNameParameters.join(" ")} \
$${volumeDefinition.mountPoint.name}
${installationParameters.join(" ")} \
${authenticationParameters.join(" ")}`;

      const command = docker.buildDockerCommand({
        command: helmCommand,
        image: HELM_IMAGE_NAME,
        environmentVariables: environmentalVariables,
        volumeDefinitionsArray: [volumeDefinition],
      });

      const result = await exec(command, {
        env: environmentalVariables,
      });

      return result;
    },
  );
}

async function uninstall(parameters) {
  const { chartName } = parameters;

  const command = docker.buildDockerCommand({
    command: `uninstall ${chartName}`,
    image: HELM_IMAGE_NAME,
  });

  const result = await exec(command);

  return result;
}

function runCommand(parameters) {

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
