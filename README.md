# kaholo-plugin-helm
Helm CLI plugin for Kaholo.

## Method: Install
Running behind the scenses the `helm upgrade --install` command.
### Parameters
1. Directory Path - The path to the directory of your chart.
2. Release Name - The name of the release (Can be unspecified if using `Generate Name`)
3. Generate Name - If release name wasn't specified, this will automatically generate a name.
4. Namespace - The namespace for the release.
5. Endpoint URL - Kuberenetes cluster API Endpoint URL.
6. Certificate Authority - Kuberenetes cluster certificate authority.
7. Service Account Token - Token of the service account to use.
8. Service Account Name - The name of the service account
9. Helm Variables - Either array of strings or one variable per line. Each variable is push with `--set` to the command.