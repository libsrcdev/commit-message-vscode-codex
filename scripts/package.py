"""Build a dependency-free VS Code extension archive."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape

root = Path(__file__).resolve().parent.parent
package = json.loads((root / 'package.json').read_text())
manifest = f'''<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
 <Metadata>
  <Identity Language="en-US" Id="{package['name']}" Version="{package['version']}" Publisher="{package['publisher']}" />
  <DisplayName>{escape(package['displayName'])}</DisplayName>
  <Description xml:space="preserve">{escape(package['description'])}</Description>
  <Tags>git,commit,codex</Tags><Categories>SCM Providers</Categories><GalleryFlags>Public</GalleryFlags>
  <Properties>
   <Property Id="Microsoft.VisualStudio.Code.Engine" Value="{package['engines']['vscode']}" />
   <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="vscode.git" />
   <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
   <Property Id="Microsoft.VisualStudio.Code.ExtensionKind" Value="workspace" />
  </Properties>
 </Metadata>
 <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code" /></Installation>
 <Dependencies />
 <Assets>
  <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/images/icon.png" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Content.Details" Path="extension/README.md" Addressable="true" />
  <Asset Type="Microsoft.VisualStudio.Services.Content.License" Path="extension/LICENSE" Addressable="true" />
 </Assets>
</PackageManifest>'''
types = '''<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="json" ContentType="application/json" />
 <Default Extension="js" ContentType="application/javascript" />
 <Default Extension="md" ContentType="text/markdown" />
 <Default Extension="png" ContentType="image/png" />
 <Default Extension="svg" ContentType="image/svg+xml" />
 <Default Extension="vsixmanifest" ContentType="text/xml" />
 <Override PartName="/extension/LICENSE" ContentType="text/plain" />
 <Override PartName="/extension/images/LICENSE.phosphor" ContentType="text/plain" />
</Types>'''
output = root / f"{package['name']}-{package['version']}.vsix"
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    archive.writestr('extension.vsixmanifest', manifest)
    archive.writestr('[Content_Types].xml', types)
    for name in ['package.json', 'extension.js', 'core.js', 'README.md', 'LICENSE', 'images/icon.png', 'images/icon.svg', 'images/LICENSE.phosphor']:
        archive.write(root / name, f'extension/{name}')
print(output)
