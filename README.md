# Kaholo Helm Plugin
This plugin extends Kaholo's functionality by providing access to the [Helm CLI](htps://helm.sh/). Helm Charts help you define, install, and upgrade even the most complex Kubernetes application. 

## Prerequisites
To use Helm, you will require a [Kubernetes](https://kubernetes.io/) cluster. A Kubernetes cluster is a physical or virtual machine running a Kubernetes Control Plane and at least one Kubernetes Node. Within Kubernetes Nodes, one can run pods, which are containers not unlike [Docker containers](https://www.docker.com/resources/what-container/). Running containerized applications has become wildly popular because it provides a highly standard, secure, scalable, and lightweight architecture with features such as auto-scaling and rolling upgrades.

There are several Kaholo plugins that create Kubernetes clusters, including ones for cloud platforms [Google GKE](https://github.com/Kaholo/kaholo-plugin-google-cloud-kubernetes-engine), [Amazon EKS](https://github.com/Kaholo/kaholo-plugin-aws-eks), and [Azure](https://github.com/Kaholo/kaholo-plugin-azure-cli). Alternatively you may run your own kubernetes using microk8s or minikube, among others.

Helm then organizes containerized Kubernetes applications into packages called [Helm Charts](https://helm.sh/docs/topics/charts/). Charts can be customized for your specific needs but are also made widely available in public repositories such as [ArtifactHub](https://artifacthub.io/). This allows anyone with a Kubernetes cluster to deploy countless software applications quickly and effortlessly.

To use the Helm plugin for Kaholo, you will need a service account with sufficient access to your Kubernetes cluster. A newly create cluster often provides a default administrative account. These accounts are generally not suitable for automating the installation Helm charts. For example they may require web-based logins and use OAuth tokens that expire within an hour. However, these accounts are useful for creating appropriate service accounts for automation - for use in Kaholo and with Helm.

## Access and Authentication
There are many ways to get appropriate access and authentication to a Kubernetes cluster, and the exact method will vary greatly from provider to provider. The kubernetes CLI (`kubectl`) is a common tool that works well with ALL implementations of kubernetes.

Here is an example using Google's CLI (`glcoud`) to gain access too an existing GKE Kubernetes cluster and then `kubectl` to create a service account named `kaholo` in namespace `dev-test`. This type of service account is ideal for use in automation.

    # gain access to the cluster in GKE
    ken@cm0108au-bravo:~$ gcloud container clusters get-credentials mynewcluster --zone=europe-central2-b
    Fetching cluster endpoint and auth data.
    kubeconfig entry generated for mynewcluster.

    # get the cluster's CA certificate and server endpoint
    ken@cm0108au-bravo:~$ kubectl config view --raw
    apiVersion: v1
    clusters:
    - cluster:
        certificate-authority-data: LS0tLS1CRUd...very long string...FLS0tLS0K
        server: https://34.116.131.193
    name: gke_plugins-helm-alpha_europe-central2-b_mynewcluster

    # create a Kubernetes namespace
    ken@cm0108au-bravo:~$ kubectl create namespace dev-test
    namespace/dev-test created

    # create a service account
    ken@cm0108au-bravo:~$ kubectl create serviceaccount kaholo --namespace dev-test
    serviceaccount/kaholo created

    # grant the service account cluster-admin privileges
    ken@cm0108au-bravo:~$ kubectl create rolebinding dev-test-admin --clusterrole=cluster-admin --serviceaccount=dev-test:kaholo --namespace=dev-test
    rolebinding.rbac.authorization.k8s.io/dev-test-admin created

    # get the name of the token for the service account
    ken@cm0108au-bravo:~$ kubectl describe serviceaccount kaholo --namespace dev-test
    Name:                kaholo
    Namespace:           dev-test
    Tokens:              kaholo-token-wlhpr

    ken@cm0108au-bravo:~$ kubectl describe secret kaholo-token-wlhpr --namespace dev-test
    Name:         kaholo-token-wlhpr
    Namespace:    dev-test
    Annotations:  kubernetes.io/service-account.name: kaholo
                kubernetes.io/service-account.uid: e57f89c4-74b3-4f48-870e-71236d6d8e8e

    Type:  kubernetes.io/service-account-token

    Data
    ====
    token:      eyJhbGciOiJ...very long string...JK3RGEpfDA
    ca.crt:     1509 bytes
    namespace:  8 bytes

In this example we now have all we need to use Helm in Kaholo:
* Cluster CA Certificate: `LS0tLS1CRUd...very long string...FLS0tLS0K`
* API Server Endpoint: `https://34.116.131.193`
* Service Account Token: `eyJhbGciOiJ...very long string...JK3RGEpfDA`
* Namespace: `dev-test`

Note: Some implementations of Kubernetes will provide the CA certificate in standard multiline PEM format that starts with `-----BEGIN CERTIFICATE-----`. The Helm plugin can make use of either this or the Base64 format seen in kubectl output.

>Careful!
>
>When copying very long Base64 strings, a common problem is for word-wrap features to result in newline characters inserted into the copy. When pasted in this condition authentication will fail. To avoid this, turn word-wrap off before copying or otherwise ensure you have copied a single one-line string. When you then paste into the Kaholo vault or CA Certificate parameter it will get word-wrapped again, but this is normal and harmless.

## Use of Docker
This plugin relies on the `alpine/helm` image from [Docker Hub](https://hub.docker.com/r/alpine/helm) to run the Helm command, `helm`. This has many upsides but a few downsides as well of which the user should be aware.

If running your own Kaholo agents in a custom environment, you will have to ensure docker is installed and running on the agent and has sufficient privilege to retrieve the image and start a container. If the agent is already running in a container (kubernetes or docker) then this means a docker container running within another container.

The first time the plugin is used on each agent, docker may spend a minute or two downloading the image. After that the delay of starting up another docker image each time is quite small, a second or two.

Next, because the CLI is running inside a docker container, it will not have access to the complete filesystem on the Kaholo agent. Parameter "Working Directory" is particularly important for this. Suppose on the agent you have a repository cloned at location `/home/k8repo/helmcharts`, and you wish to install charts within that directory. You must specify this in parameter Working Directory for it to be accessible within the plugin.

Helm uses a few locations to store plugins, configuration, and cache in the users home folder. On a Kaholo Agent this is `/tmp/helmHome/`. This folder is always mounted as a docker volume so these things are persisted on the Kaholo agent from one execution to the next, even though the container running the helm commands is recreated and destroyed with each execution. For example if an action adds a Helm repository, the following action will be able to install a chart referenced from that repository.

Should these limitations negatively impact on your use case, please [let us know](https://kaholo.io/contact/).

## Plugin Installation
For download, installation, upgrade, downgrade and troubleshooting of plugins in general, see [INSTALL.md](./INSTALL.md).

## Plugin Settings
Plugin settings act as default parameter values. If configured in plugin settings, the action parameters may be left unconfigured. Action parameters configured anyway over-ride the plugin-level settings for that Action.
* Default Working Directory - The location on the Kaholo Agent where your helm charts are located. Normally this is a git repository that was cloned onto the Agent using the Kaholo Git Plugin in a previous action in the pipeline. If you are not working with your own charts then this parameter can be left unconfigured.
Plugin Settings is found in `Settings | Plugins | Helm`. Click on the name of the plugin, it is a link to plugin settings.

## Kaholo Account
The helm plugin makes use of Kaholo accounts. This is a group of parameters specific to the kubernetes cluster, used for access and authentication. The account can be configured in the Action or along side Plugin Settings. The idea behind accounts is that you can configure these once and then use them again and again in your pipelines without having to configure them again.

Helm uses the same type of account as Kubernetes, so if you have already configured an account for the Kubernetes plugin you can simply use that.
* Cluster CA Certificate: `LS0tLS1CRUd...very long string...FLS0tLS0K`
* API Server Endpoint: `https://34.116.131.193`
* Service Account Token: `eyJhbGciOiJ...very long string...JK3RGEpfDA`
* Namespace: `dev-test`

## Plugin Methods ##
This plugin has methods to install, upgrade, and uninstall Helm charts, another to list those installed already and a final generic "Run Helm Command" method to cover whatever else you might need to do with Helm, for example adding a repository of charts to the configuration.

## Method: Install ##
Method `Install` installs a helm chart, or "release".

### Parameter: Chart ###
There are a variety of ways to specify a Helm Chart...
* If the chart is a directory on the Kaholo Agent in the specified Working Directory, then just the chart's directory name is sufficient. Otherwise use the path to the directory, either absolute path (`/twiddlebug/workspace/helmcharts/mychart`) or relative path (`./helmcharts/mychart`). If Working Directory is not specified, the path **must** begin with `/` or `./`.
* If the chart is a packaged tgz file on Kaholo Agent, do the same as for the directory but using filename instead, or absolute or relative path to the file.
* If the chart comes from a repository, be sure to use method "Run Helm Command" first and add the repo to Helm's configuration with a command such as `helm repo add bitnami https://charts.bitnami.com/bitnami`. Then parameter Chart for this method can reference that repo, e.g. `bitnami/drupal`. The list of configured repositories can be found by using method "Run Helm Command" to run `helm repo list`.
* Packaged charts can also be installed using the full URL to the package as parameter Chart, e.g. `https://helmrepo.internal/charts/theapp.tgz`.
* For OCI registries, use the OCI URI, e.g. `oci://helmrepo.internal/charts/theapp`.

### Parameter: Release Name ###
A given Helm chart can be deployed many times, for example to provide multiple identical environments. To distinguish each chart deployments from the next, they each must be given a cluster-wide unique "release name". For example deploying chart "drupal" with release name "piper", the resulting deployment is named `piper-drupal`. If none is given then an arbitrary one will be assigned anyway (e.g. `drupal-1656768801`) to ensure each release is unique.

### Parameter: Values Overrides ###
Use this parameter if you wish to override any values declared in the values.yaml file of the Helm chart. For example a chart might include `replicaCount: 1`, and you can increase this by configuring this parameter with `replicaCount=3`. This is the equivalent of the `--set` option used when running helm at a command line.

### Parameter: Namespace ###
This is the namespace where Helm is specified to deploy the release. If left empty the "default" namespace is used. If your Kubernetes credentials in the Kaholo Account are restricted in namespace, then an appropriate namespace must be used either here or in the chart itself.

### Parameter: Working Directory ###
This parameter is optional, but if the Working Directory is configured to be one on the Kaholo Agent that contains Helm Chart Directories, the charts themselves can then be referred to with just their directory names alone. For example the chart is at absolute path `/twiddlebug/workspace/helmcharts/mychart` and Working Directory is either `/twiddlebug/workspace/helmcharts` or just `helmcharts` (because `/twiddlebug/workspace` is the default working directory already), then parameter Chart can be simply `mychart`.

## Method: Upgrade ##
This method is equivalent to method Install, only it upgrades existing releases instead of installing non-existent ones.

## Method: Uninstall ##
Method `Uninstall` uninstalls a helm chart that has already been installed in the cluster. There is only one parameter to uninstall.

### Parameter: Release Name ###
This is the name of the release as it was installed. Either the same release name (e.g. `piper`) or the arbitrarily assigned one if no release name was given (e.g. `drupal-1656768801`).

## Method: List Releases ##
This method lists deployed releases in tabular or JSON format.

### Parameter: Namespace ###
To list releases in only one namespace provide the namespace here. If none is specified, the releases of all namespaces are listed.

### Parameter: List In JSON Format ###
If selected (default) the output in Kaholo Final Results will be in JSON format rather than tabular text.

## Method: Run Helm Command ##
This is a generic method that simply runs whatever helm command you provide on the command line for you. Only helm commands can be run using this method. For other commands use the Command Line Plugin instead. Examples include:
* `helm repo add bitnami https://charts.bitnami.com/bitnami`
* `helm install mydrupal bitnami/drupal`
* `helm env`
* `helm version`
