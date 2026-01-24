from packaging import version

from webdriver_manager.core.driver import Driver
from webdriver_manager.core.logger import log
from webdriver_manager.core.os_manager import ChromeType
import json


class ChromeDriver(Driver):

    def __init__(
            self,
            name,
            driver_version,
            url,
            latest_release_url,
            http_client,
            os_system_manager,
            chrome_type=ChromeType.GOOGLE
    ):
        super(ChromeDriver, self).__init__(
            name,
            driver_version,
            url,
            latest_release_url,
            http_client,
            os_system_manager
        )
        self._browser_type = chrome_type

    def get_driver_download_url(self, os_type):
        driver_version_to_download = self.get_driver_version_to_download()
        # For Mac ARM CPUs after version 106.0.5249.61 the format of OS type changed
        # to more unified "mac_arm64". For newer versions, it'll be "mac_arm64"
        # by default, for lower versions we replace "mac_arm64" to old format - "mac64_m1".
        if version.parse(driver_version_to_download) < version.parse("106.0.5249.61"):
            os_type = os_type.replace("mac_arm64", "mac64_m1")

        if version.parse(driver_version_to_download) >= version.parse("115"):
            if os_type == "mac64":
                os_type = "mac-x64"
            if os_type in ["mac_64", "mac64_m1", "mac_arm64"]:
                os_type = "mac-arm64"

            modern_version_url = self.get_url_for_version_and_platform(driver_version_to_download, os_type)
            log(f"Modern chrome version {modern_version_url}")
            return modern_version_url

        return f"{self._url}/{driver_version_to_download}/{self.get_name()}_{os_type}.zip"

    def get_browser_type(self):
        return self._browser_type

    def get_latest_release_version(self):
        determined_browser_version = self.get_browser_version_from_os()
        log(f"Get LATEST {self._name} version for {self._browser_type}")
        if determined_browser_version is not None and version.parse(determined_browser_version) >= version.parse("115"):
            url = "https://registry.npmmirror.com/-/binary/chrome-for-testing/"
            response = self._http_client.get(url)
            response_dict = json.loads(response.text)
            determined_browser_version = response_dict.get("builds").get(determined_browser_version).get("version")
            return determined_browser_version
        elif determined_browser_version is not None:
            # Remove the build version (the last segment) from determined_browser_version for version < 113
            determined_browser_version = ".".join(determined_browser_version.split(".")[:3])
            latest_release_url = f"{self._latest_release_url}_{determined_browser_version}"
        else:
            latest_release_url = self._latest_release_url

        resp = self._http_client.get(url=latest_release_url)
        return resp.text.rstrip()

    def get_url_for_version_and_platform(self, browser_version, platform):
        url = f"https://registry.npmmirror.com/-/binary/chrome-for-testing/{browser_version}/"

        platform_path_map = {
            'linux64': 'linux64/chromedriver-linux64.zip',
            'mac-x64': 'mac-x64/chromedriver-mac-x64.zip',
            'mac-arm64': 'mac-arm64/chromedriver-mac-arm64.zip',
            'win32': 'win32/chromedriver-win32.zip',
            'win64': 'win64/chromedriver-win64.zip',
        }

        download_url = url + platform_path_map[platform]
        return download_url
