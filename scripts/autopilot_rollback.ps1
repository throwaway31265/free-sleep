<#
.SYNOPSIS
  Run scripts/autopilot_rollback.sh on the pod from Windows (through WSL + SSH).

.DESCRIPTION
  Wraps:
    wsl.exe -e bash -c "ssh -i ~/.ssh/id_rsa -p 8822 rewt@<pod> 'sudo sh /home/dac/free-sleep/scripts/autopilot_rollback.sh <args>'"
  Only the rollback script's own flags are forwarded, so nothing else can be
  injected into the remote command. The exit code is the script's exit code
  (0 = PASS, 1 = FAIL, 2 = bad arguments).

.EXAMPLE
  .\autopilot_rollback.ps1 -PodIp 192.168.1.50  # --soft
  .\autopilot_rollback.ps1 --status             # pod address from $env:FREE_SLEEP_POD_IP
  .\autopilot_rollback.ps1 --full --dry-run
  .\autopilot_rollback.ps1 --full --purge
#>
[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$PodIp = $env:FREE_SLEEP_POD_IP,
  [int]$Port = 8822,
  [string]$User = 'rewt',
  [string]$KeyPath = '~/.ssh/id_rsa',
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RollbackArgs = @()
)

$allowedFlags = @('--soft', '--full', '--status', '--purge', '--dry-run', '--help')
foreach ($flag in $RollbackArgs) {
  if ($allowedFlags -notcontains $flag) {
    Write-Error "Unsupported argument '$flag'. Allowed: $($allowedFlags -join ', ')"
    exit 2
  }
}
if ([string]::IsNullOrWhiteSpace($PodIp)) {
  Write-Error "Pass -PodIp <address> or set `$env:FREE_SLEEP_POD_IP."
  exit 2
}
if ($PodIp -notmatch '^[A-Za-z0-9.\-]+$') {
  Write-Error "Invalid pod address '$PodIp'."
  exit 2
}
if ($User -notmatch '^[A-Za-z0-9_\-]+$' -or $KeyPath -notmatch '^[A-Za-z0-9_~./\-]+$') {
  Write-Error 'Invalid user or key path.'
  exit 2
}

$remoteCommand = ('sudo sh /home/dac/free-sleep/scripts/autopilot_rollback.sh ' + ($RollbackArgs -join ' ')).Trim()
$sshCommand = "ssh -i $KeyPath -p $Port $User@$PodIp '$remoteCommand'"

Write-Host "Running on ${PodIp}: $remoteCommand"
& wsl.exe -e bash -c $sshCommand
exit $LASTEXITCODE
