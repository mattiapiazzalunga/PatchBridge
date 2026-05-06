param(
  [switch]$CheckOnly,
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$minimums = @{
  Git = [version]"2.30.0"
  "Node.js" = [version]"22.12.0"
  npm = [version]"10.0.0"
}

function Resolve-Application {
  param([string]$Name)

  $commands = Get-Command $Name -All -ErrorAction SilentlyContinue
  $application = $commands | Where-Object { $_.CommandType -eq "Application" } | Select-Object -First 1
  if ($application) {
    return $application.Source
  }
  return $null
}

function Get-VersionFromText {
  param([string]$Text)

  if ($Text -match "v?(\d+)\.(\d+)\.(\d+)") {
    return [version]::new([int]$Matches[1], [int]$Matches[2], [int]$Matches[3])
  }
  return $null
}

function Invoke-ToolVersion {
  param(
    [string]$Path,
    [string]$Argument
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Path
  $startInfo.Arguments = $Argument
  $startInfo.WorkingDirectory = $repoRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  return @{
    ExitCode = $process.ExitCode
    Text = (($stdout + " " + $stderr).Trim())
  }
}

function Get-RequirementStatus {
  $definitions = @(
    @{
      Name = "Git"
      Command = "git"
      Argument = "--version"
      Download = "https://git-scm.com/download/win"
      Install = "winget install --id Git.Git -e"
    },
    @{
      Name = "Node.js"
      Command = "node"
      Argument = "--version"
      Download = "https://nodejs.org/en/download"
      Install = "winget install OpenJS.NodeJS.LTS"
    },
    @{
      Name = "npm"
      Command = "npm"
      Argument = "--version"
      Download = "https://nodejs.org/en/download"
      Install = "winget install OpenJS.NodeJS.LTS"
    }
  )

  foreach ($definition in $definitions) {
    $path = Resolve-Application $definition.Command
    $status = [ordered]@{
      Name = $definition.Name
      Command = $definition.Command
      Path = $path
      Installed = [bool]$path
      Supported = $false
      Version = $null
      Minimum = $minimums[$definition.Name]
      Message = ""
      Download = $definition.Download
      Install = $definition.Install
    }

    if (-not $path) {
      $status.Message = "Missing"
      [pscustomobject]$status
      continue
    }

    try {
      $result = Invoke-ToolVersion -Path $path -Argument $definition.Argument
      $version = Get-VersionFromText $result.Text
      $status.Version = $version
      if ($result.ExitCode -ne 0 -or -not $version) {
        $status.Message = "Installed, but version could not be verified"
      } elseif ($version -lt $status.Minimum) {
        $status.Message = "Outdated"
      } else {
        $status.Supported = $true
        $status.Message = "Ready"
      }
    } catch {
      $status.Message = "Installed, but could not be started"
    }

    [pscustomobject]$status
  }
}

function Format-ArgumentList {
  param([string[]]$Arguments)

  ($Arguments | ForEach-Object {
    if ($_ -match '[\s"]') {
      '"' + ($_ -replace '"', '\"') + '"'
    } else {
      $_
    }
  }) -join " "
}

function New-ProcessStartInfo {
  param(
    [string]$FileName,
    [string[]]$Arguments,
    [switch]$RedirectOutput
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $extension = [System.IO.Path]::GetExtension($FileName).ToLowerInvariant()
  if ($extension -eq ".cmd" -or $extension -eq ".bat") {
    $argumentText = Format-ArgumentList $Arguments
    $escaped = '"' + $FileName + '"' + $(if ($argumentText) { " $argumentText" } else { "" })
    $startInfo.FileName = "$env:ComSpec"
    $startInfo.Arguments = "/d /s /c ""$escaped"""
  } else {
    $startInfo.FileName = $FileName
    $startInfo.Arguments = Format-ArgumentList $Arguments
  }
  $startInfo.WorkingDirectory = $repoRoot
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = [bool]$RedirectOutput
  $startInfo.RedirectStandardError = [bool]$RedirectOutput
  return $startInfo
}

function Start-LoggedProcess {
  param(
    [string]$FileName,
    [string[]]$Arguments
  )

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = New-ProcessStartInfo -FileName $FileName -Arguments $Arguments -RedirectOutput
  [void]$process.Start()
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  return @{
    ExitCode = $process.ExitCode
    Output = (($stdout + [Environment]::NewLine + $stderr).Trim())
  }
}

function Start-HiddenProcess {
  param(
    [string]$FileName,
    [string[]]$Arguments
  )

  $startInfo = New-ProcessStartInfo -FileName $FileName -Arguments $Arguments
  return [System.Diagnostics.Process]::Start($startInfo)
}

if ($CheckOnly) {
  Get-RequirementStatus | Format-Table -AutoSize
  exit 0
}

if ($SelfTest) {
  $npm = Resolve-Application "npm"
  if (-not $npm) {
    throw "npm is not available on PATH."
  }
  $result = Start-LoggedProcess -FileName $npm -Arguments @("--version")
  if ($result.ExitCode -ne 0) {
    throw "Launcher process self-test failed with exit code $($result.ExitCode)."
  }
  $hidden = Start-HiddenProcess -FileName $npm -Arguments @("--version")
  $hidden.WaitForExit(10000) | Out-Null
  if (-not $hidden.HasExited -or $hidden.ExitCode -ne 0) {
    throw "Launcher hidden-process self-test failed."
  }
  "Launcher process self-test OK"
  exit 0
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$form = [System.Windows.Forms.Form]::new()
$form.Text = "PatchBridge Launcher"
$form.StartPosition = "CenterScreen"
$form.Size = [System.Drawing.Size]::new(860, 620)
$form.MinimumSize = [System.Drawing.Size]::new(720, 520)
$form.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)

$header = [System.Windows.Forms.Label]::new()
$header.Text = "PatchBridge Launcher"
$header.Font = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
$header.Location = [System.Drawing.Point]::new(22, 18)
$header.Size = [System.Drawing.Size]::new(500, 34)
$form.Controls.Add($header)

$description = [System.Windows.Forms.Label]::new()
$description.Text = "Checks the system, highlights anything missing, installs dependencies, and starts PatchBridge."
$description.Location = [System.Drawing.Point]::new(24, 56)
$description.Size = [System.Drawing.Size]::new(780, 24)
$form.Controls.Add($description)

$statusLabel = [System.Windows.Forms.Label]::new()
$statusLabel.Text = "Checking requirements..."
$statusLabel.Location = [System.Drawing.Point]::new(24, 88)
$statusLabel.Size = [System.Drawing.Size]::new(780, 24)
$form.Controls.Add($statusLabel)

$list = [System.Windows.Forms.ListView]::new()
$list.Location = [System.Drawing.Point]::new(24, 120)
$list.Size = [System.Drawing.Size]::new(796, 150)
$list.Anchor = "Top,Left,Right"
$list.View = "Details"
$list.FullRowSelect = $true
$list.GridLines = $true
[void]$list.Columns.Add("Component", 130)
[void]$list.Columns.Add("Status", 230)
[void]$list.Columns.Add("Detected", 170)
[void]$list.Columns.Add("Minimum", 110)
[void]$list.Columns.Add("Location", 330)
$form.Controls.Add($list)

$startButton = [System.Windows.Forms.Button]::new()
$startButton.Text = "Install and Start"
$startButton.Location = [System.Drawing.Point]::new(24, 286)
$startButton.Size = [System.Drawing.Size]::new(150, 36)
$form.Controls.Add($startButton)

$recheckButton = [System.Windows.Forms.Button]::new()
$recheckButton.Text = "Re-check"
$recheckButton.Location = [System.Drawing.Point]::new(184, 286)
$recheckButton.Size = [System.Drawing.Size]::new(105, 36)
$form.Controls.Add($recheckButton)

$downloadsButton = [System.Windows.Forms.Button]::new()
$downloadsButton.Text = "Open Downloads"
$downloadsButton.Location = [System.Drawing.Point]::new(299, 286)
$downloadsButton.Size = [System.Drawing.Size]::new(140, 36)
$form.Controls.Add($downloadsButton)

$copyButton = [System.Windows.Forms.Button]::new()
$copyButton.Text = "Copy Fix Commands"
$copyButton.Location = [System.Drawing.Point]::new(449, 286)
$copyButton.Size = [System.Drawing.Size]::new(155, 36)
$form.Controls.Add($copyButton)

$log = [System.Windows.Forms.TextBox]::new()
$log.Location = [System.Drawing.Point]::new(24, 338)
$log.Size = [System.Drawing.Size]::new(796, 218)
$log.Anchor = "Top,Bottom,Left,Right"
$log.Multiline = $true
$log.ReadOnly = $true
$log.ScrollBars = "Vertical"
$log.Font = [System.Drawing.Font]::new("Consolas", 9)
$log.BackColor = [System.Drawing.Color]::FromArgb(17, 24, 39)
$log.ForeColor = [System.Drawing.Color]::FromArgb(229, 231, 235)
$form.Controls.Add($log)

$script:requirements = @()

function Add-LogLine {
  param([string]$Text)
  if (-not $Text) { return }
  $log.AppendText($Text + [Environment]::NewLine)
}

function Refresh-Requirements {
  $script:requirements = @(Get-RequirementStatus)
  $list.Items.Clear()

  foreach ($requirement in $script:requirements) {
    $item = [System.Windows.Forms.ListViewItem]::new($requirement.Name)
    [void]$item.SubItems.Add($requirement.Message)
    [void]$item.SubItems.Add($(if ($requirement.Version) { $requirement.Version.ToString() } else { "Not found" }))
    [void]$item.SubItems.Add($requirement.Minimum.ToString())
    [void]$item.SubItems.Add($(if ($requirement.Path) { $requirement.Path } else { "" }))

    if ($requirement.Supported) {
      $item.BackColor = [System.Drawing.Color]::FromArgb(236, 253, 243)
      $item.ForeColor = [System.Drawing.Color]::FromArgb(22, 128, 71)
    } else {
      $item.BackColor = [System.Drawing.Color]::FromArgb(255, 241, 240)
      $item.ForeColor = [System.Drawing.Color]::FromArgb(180, 35, 24)
    }
    [void]$list.Items.Add($item)
  }

  $missing = @($script:requirements | Where-Object { -not $_.Supported })
  $startButton.Enabled = $missing.Count -eq 0
  $downloadsButton.Enabled = $missing.Count -gt 0
  $copyButton.Enabled = $missing.Count -gt 0

  if ($missing.Count -eq 0) {
    $statusLabel.Text = "All requirements are ready. Click Install and Start."
  } else {
    $statusLabel.Text = "Missing or outdated requirements are highlighted in red."
  }
}

$recheckButton.Add_Click({
  Add-LogLine "Re-checking requirements..."
  Refresh-Requirements
})

$downloadsButton.Add_Click({
  $script:requirements |
    Where-Object { -not $_.Supported } |
    Select-Object -ExpandProperty Download -Unique |
    ForEach-Object { Start-Process $_ }
})

$copyButton.Add_Click({
  $commands = $script:requirements |
    Where-Object { -not $_.Supported } |
    Select-Object -ExpandProperty Install -Unique
  [System.Windows.Forms.Clipboard]::SetText(($commands -join [Environment]::NewLine))
  Add-LogLine "Copied install commands to the clipboard."
})

$startButton.Add_Click({
  Refresh-Requirements
  if (($script:requirements | Where-Object { -not $_.Supported }).Count -gt 0) {
    Add-LogLine "Startup blocked because at least one requirement is missing or outdated."
    return
  }
  $startButton.Enabled = $false
  $recheckButton.Enabled = $false
  $log.Clear()
  Add-LogLine "Repository: $repoRoot"

  try {
    $npm = Resolve-Application "npm"
    if (-not $npm) {
      throw "npm is not available on PATH."
    }

    $statusLabel.Text = "Installing dependencies..."
    $form.Refresh()
    Add-LogLine "Installing dependencies with npm install..."
    $install = Start-LoggedProcess -FileName $npm -Arguments @("install")
    if ($install.Output) {
      Add-LogLine $install.Output
    }
    if ($install.ExitCode -ne 0) {
      throw "npm install failed with exit code $($install.ExitCode)."
    }

    $statusLabel.Text = "Starting PatchBridge..."
    $form.Refresh()
    Add-LogLine "Starting PatchBridge..."
    $process = Start-HiddenProcess -FileName $npm -Arguments @("start")
    Start-Sleep -Seconds 4
    if ($process.HasExited) {
      throw "PatchBridge closed during startup. Run npm start manually for detailed Electron diagnostics."
    }

    $statusLabel.Text = "PatchBridge has started."
    Add-LogLine "PatchBridge is running. You can close this launcher."
  } catch {
    $statusLabel.Text = "Startup failed."
    Add-LogLine $_.Exception.Message
  } finally {
    $startButton.Enabled = $true
    $recheckButton.Enabled = $true
  }
})

Refresh-Requirements
[void][System.Windows.Forms.Application]::Run($form)
