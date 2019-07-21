// @flow
import * as React from 'react';
import { shell, remote } from 'electron';
import Button from 'component/button';
import CopyableText from 'component/copyableText';
import AdmZip from 'adm-zip';
import path from 'path';

type Props = {
  daemonSettings: {
    wallet_dir: ?string,
  },
};

type State = {
  errorMessage: ?string,
  successMessage: ?string,
};

class WalletBackup extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    this.state = {
      errorMessage: null,
      successMessage: null,
    };
  }

  showErrorMessage(message: string) {
    this.setState({ errorMessage: message });
  }

  showSuccessMessage(message: string) {
    this.setState({ successMessage: message });
  }

  clearMessages() {
    this.setState({ errorMessage: null, successMessage: null });
  }

  backupWalletDir(lbryumWalletDir: ?string) {
    this.clearMessages();

    if (!lbryumWalletDir) {
      this.showErrorMessage(__('No wallet folder was found.'));
      return;
    }

    // Colon fails on Windows. Backups should be portable, so replace it on other platforms, too.
    const filenameTime = new Date().toISOString().replace(/:/g, '-');

    const outputFilename = [path.basename(lbryumWalletDir), '-', filenameTime, '.zip'].join('');

    // Prefer placing backup in user's Downloads folder, then their home folder, and finally
    // right next to the lbryum folder itself.
    let outputDir = path.dirname(lbryumWalletDir);
    if (remote && remote.app) {
      outputDir = remote.app.getPath('downloads') || remote.app.getPath('home') || outputDir;
    }

    const outputPath = path.join(outputDir, outputFilename);

    const zip = new AdmZip();

    try {
      zip.addLocalFolder(lbryumWalletDir);
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      this.showErrorMessage(__('The wallet folder could not be added to the zip archive.'));
      return;
    }

    try {
      zip.writeZip(outputPath);
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      this.showErrorMessage(__('There was a problem writing the zip archive to disk.'));
      return;
    }

    this.showSuccessMessage(__('Saved zip archive to ' + outputPath));

    shell.showItemInFolder(outputPath);
  }

  render() {
    const { daemonSettings = {} } = this.props;
    const { wallet_dir: lbryumWalletDir } = daemonSettings;

    return (
      <section className="card card--section">
        <h2 className="card__title">{__('Backup Your LBRY Credits')}</h2>

        <ul className="card__subtitle ol--bulleted">
          <li>
            {__(
              'Your LBRY credits are controllable by you and only you, via wallet file(s) stored locally on your computer.'
            )}
          </li>
          <li>
            {__(
              'Currently, there is no automatic backup. If you lose access to these files, you will lose your credits.'
            )}
          </li>
          <li>
            {__(
              'However, it is fairly easy to back up manually. To backup your wallet, make a copy of the folder listed below:'
            )}
          </li>
        </ul>
        <CopyableText copyable={lbryumWalletDir} snackMessage={__('Path copied.')} />
        <p className="help">
          {__(
            'Access to these files are equivalent to having access to your credits. Keep any copies you make of your wallet in a secure place.'
          )}{' '}
          {/* @i18fixme */}
          {__('For more details on backing up and best practices')},{' '}
          <Button button="link" href="https://lbry.com/faq/how-to-backup-wallet" label={__('see this article')} />.
        </p>
        <p className={'card__message card__message--error' + (this.state.errorMessage ? '' : ' hidden')}>
          {this.state.errorMessage}
        </p>
        <p className={'card__message card__message--success' + (this.state.successMessage ? '' : ' hidden')}>
          {this.state.successMessage}
        </p>
        <div className="card__actions">
          <Button button="inverse" label={__('Create Backup')} onClick={() => this.backupWalletDir(lbryumWalletDir)} />
          <Button button="link" label={__('Open Folder')} onClick={() => shell.openItem(lbryumWalletDir)} />
        </div>
      </section>
    );
  }
}

export default WalletBackup;
