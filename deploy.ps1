param(
    [ValidateSet("frontend", "backend", "all")]
    [string]$Target = "all"
)

# PowerShell 错误处理策略，Stop 表示： 一旦 PowerShell 命令发生错误，立即停止脚本。
$ErrorActionPreference = "Stop"

# =====================================================================
# 配置区
# =====================================================================
# SSH 服务器别名
$Server = "deployapp"

# Docker 命令
$DockerCmd = "docker"

# 前端源码目录
$FrontendSourceDir = "saleshub_web"

# 前端构建产物目录
$FrontendBuildDir = "saleshub_web/dist"

# 服务器上的前端静态文件目录
$FrontendRemoteDir = "/app/web_app/sales"

# 前端备份目录
$FrontendBackupDir = "/app/backups/sales"

# 后端源码目录
$BackendSourceDir = "saleshub_serv"

# 服务器上的后端代码目录
$BackendRemoteDir = "/app/service/saleshub_serv/dist"

# 后端构建产物目录
$BackendBuildDir = "saleshub_serv/dist"

# 服务器备份目录
$BackendBackupDir = "/app/backups/saleshub_serv/dist"

# 后端 Docker 容器名
$BackendContainer = "saleshub_serv"

# 是否使用 Docker Compose 管理后端
$UseCompose = $false

# Docker Compose 配置，只有当 $UseCompose = $true 时才需要配置。
# $ComposeDir：
#   服务器上 docker-compose.yml 所在目录。
# $ComposeService：
#   docker-compose.yml 里面后端服务的名字。
$ComposeDir = "/opt/app"
$ComposeService = "backend"

# 后端远程构建命令
$RemoteBackendBuildCmd = ""

# 健康检查命令
$HealthCheckCmd = "curl -fsS http://120.24.45.111/saleshub/health"


# 打印普通日志
function Write-Log {
    param(
        [string]$Message
    )

    # 绿色输出日志，带当前时间
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

# 打印错误日志
function Write-Err {
    param(
        [string]$Message
    )

    # 红色输出错误日志
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor Red
}

# 检查本机是否存在某个命令
# 用法：
#   Test-Command "ssh"
function Test-Command {
    param(
        [string]$Command
    )

    # Get-Command 可以查找命令是否存在
    # -ErrorAction SilentlyContinue 表示找不到时不报错
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

# 在服务器执行远程命令
# 用法：
#   Invoke-Remote "docker ps"
function Invoke-Remote {
    param(
        [string]$Command
    )

    # Windows PowerShell 里的字符串可能是 CRLF 换行。
    # Linux Shell 更适应 LF 换行，所以这里把 CRLF 替换成 LF。
    $Command = $Command -replace "`r`n", "`n"

    # 通过 SSH 到服务器执行命令
    ssh $Server $Command

    # $LASTEXITCODE 是上一个外部命令的退出码。
    # 0 表示成功，非 0 表示失败。
    if ($LASTEXITCODE -ne 0) {
        throw "远程命令执行失败，请查看上方输出。"
    }
}

# 测试远程命令是否执行成功
# 用法：
#   Test-Remote "curl -fsS http://127.0.0.1:8000/health"
function Test-Remote {
    param(
        [string]$Command
    )

    # 同样把 CRLF 转成 LF
    $Command = $Command -replace "`r`n", "`n"

    # *> $null 表示隐藏命令输出，避免健康检查刷屏
    ssh $Server $Command *> $null

    # 返回是否成功
    return ($LASTEXITCODE -eq 0)
}

# 环境检查
function Precheck {
    Write-Log "开始环境检查"

    # 这些是本机必须存在的命令
    foreach ($cmd in @("ssh", "scp", "tar")) {
        if (-not (Test-Command $cmd)) {
            throw "本机缺少命令: $cmd，请先安装对应工具。"
        }
    }

    # 部署前端或后端都需要本机 Node/npm（或 pnpm）
    if ($Target -eq "frontend" -or $Target -eq "backend" -or $Target -eq "all") {
        if (-not (Test-Command "npm")) {
            throw "本机缺少 npm，请先安装 Node.js。"
        }
    }

    # 测试 SSH 是否能连接服务器
    if (-not (Test-Remote "echo ok")) {
        throw "SSH 连接失败: $Server，请检查 SSH 配置、密钥、服务器 IP、端口。"
    }

    Write-Log "环境检查通过"
}

# 获取临时打包目录
# 脚本会在项目根目录创建：
#   .deploy
function Get-TempDir {
    # $PSScriptRoot 表示 deploy.ps1 所在目录
    $dir = Join-Path $PSScriptRoot ".deploy"

    # 如果目录不存在则创建
    New-Item -ItemType Directory -Force -Path $dir | Out-Null

    return $dir
}

# 构建前端
function Build-Frontend {
    # 拼接前端源码目录完整路径
    $frontendPath = Join-Path $PSScriptRoot $FrontendSourceDir

    # 判断目录是否存在
    if (-not (Test-Path $frontendPath)) {
        throw "前端目录不存在: $frontendPath"
    }

    # 进入前端目录
    Push-Location $frontendPath

    try {
        # npm ci：
        # 根据 package-lock.json 安装依赖，比 npm install 更稳定。
        Write-Log "执行 pnpm install --frozen-lockfile"
        pnpm install --frozen-lockfile

        # 如果 npm ci 失败，终止脚本
        if ($LASTEXITCODE -ne 0) {
            throw "pnpm install --frozen-lockfile 失败"
        }

        # npm run build：
        # 执行前端打包命令。
        Write-Log "执行 npm run build"
        npm run build

        # 如果打包失败，终止脚本
        if ($LASTEXITCODE -ne 0) {
            throw "npm run build 失败"
        }
    }
    finally {
        # 无论成功失败，都退回原目录
        Pop-Location
    }
}

# 部署前端
# 流程：
#   1. 构建前端
#   2. 打包构建产物
#   3. 上传到服务器 /tmp
#   4. 备份服务器旧前端文件
#   5. 清空服务器前端目录
#   6. 解压新前端文件
#   7. 设置目录可读权限
#   8. 可选重启前端容器
function Deploy-Frontend {
    Write-Log "开始部署前端"

    # 1. 构建前端
    Build-Frontend

    # 2. 获取前端构建产物目录，例如 frontend/dist
    $buildPath = Join-Path $PSScriptRoot $FrontendBuildDir

    # 如果构建目录不存在，说明打包失败或配置错误
    if (-not (Test-Path $buildPath)) {
        throw "前端构建目录不存在: $buildPath"
    }

    # 3. 准备本地临时打包目录
    $tempDir = Get-TempDir
    $localTar = Join-Path $tempDir "frontend.tar.gz"

    # 如果上次打包文件还在，先删除
    if (Test-Path $localTar) {
        Remove-Item $localTar -Force
    }

    # Windows 路径使用反斜杠 \
    # tar 更适合使用正斜杠 /
    # 所以这里把 \ 替换成 /
    $buildPathUnix = $buildPath -replace '\\', '/'

    # 4. 打包前端构建产物
    #
    # tar 参数说明：
    #   -c      创建压缩包
    #   -z      使用 gzip 压缩
    #   -f      指定压缩文件名
    #   -C      切换到指定目录后再打包
    #   .       打包当前目录下的所有文件
    Write-Log "打包前端: $buildPath"
    tar -czf $localTar -C $buildPathUnix .

    # 如果打包失败，终止脚本
    if ($LASTEXITCODE -ne 0) {
        throw "前端打包失败"
    }

    # 5. 生成服务器临时文件名
    #
    # 使用时间戳避免文件名冲突。
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $remoteTar = "/tmp/deploy_frontend_$stamp.tar.gz"

    # 6. 上传压缩包到服务器
    Write-Log "上传前端包到服务器"
    scp $localTar "${Server}:${remoteTar}"

    # 如果上传失败，终止脚本
    if ($LASTEXITCODE -ne 0) {
        throw "前端包上传失败"
    }

    # 7. 在服务器执行备份、清理、解压
    Write-Log "备份并部署前端"

    # 这一段是发送到 Linux 服务器执行的 Shell 命令。
    # @" 和 "@ 之间是多行字符串。
    #
    # Shell 命令说明：
    #   set -e：
    #       任何一条命令失败，立即退出。
    #
    #   mkdir -p '$BackupDir'：
    #       创建备份目录。
    #
    #   rm -rf '$BackupDir/frontend'：
    #       删除上一次前端备份。
    #
    #   cp -a：
    #       复制目录并保留权限、时间等属性。
    #
    #   find ... -mindepth 1 -maxdepth 1 -exec rm -rf {} +：
    #       清空前端目录里的所有文件，但保留 frontend 目录本身。
    #
#   tar -xzf：
    #       解压压缩包。
    #   -m / --touch：
    #       不恢复文件修改时间，避免目标目录无 utime 权限时失败
    #       （常见于 Nginx 静态目录属主是 root / www-data）。
    #   --no-same-owner：
    #       不按包内属主还原，解压后属主为当前部署用户。
    #
    #   chmod -R a+rX：
    #       让 Nginx 用户可以读取静态文件。
    $remoteCommand = @"
set -e

mkdir -p '$FrontendBackupDir'
rm -rf '$FrontendBackupDir'

if [ -d '$FrontendRemoteDir' ]; then
    cp -a '$FrontendRemoteDir' '$FrontendBackupDir'
fi

mkdir -p '$FrontendRemoteDir'

find '$FrontendRemoteDir' -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar -xzf '$remoteTar' -C '$FrontendRemoteDir' -m --no-same-owner
rm -f '$remoteTar'

# 只改目录内文件权限，不改目录本身（部署用户通常无权 chmod 挂载根目录）
# 失败不阻断：文件默认 umask 一般已可被 Nginx 读取
find '$FrontendRemoteDir' -mindepth 1 -exec chmod a+rX {} + 2>/dev/null || true
"@

    # 执行远程 Shell 命令
    Invoke-Remote $remoteCommand

    Write-Log "前端部署完成"
}

# ---------------------------------------------------------------------
# 构建后端
#
# 默认执行：
#   pnpm install --frozen-lockfile
#   npm run build  （tsc -> dist）
# ---------------------------------------------------------------------
function Build-Backend {
    # 拼接后端源码目录完整路径
    $backendPath = Join-Path $PSScriptRoot $BackendSourceDir

    # 判断目录是否存在
    if (-not (Test-Path $backendPath)) {
        throw "后端目录不存在: $backendPath"
    }

    # 进入后端目录
    Push-Location $backendPath

    try {
        Write-Log "后端：执行 pnpm install --frozen-lockfile"
        pnpm install --frozen-lockfile

        if ($LASTEXITCODE -ne 0) {
            throw "后端 pnpm install 失败"
        }

        Write-Log "后端：执行 npm run build"
        npm run build

        if ($LASTEXITCODE -ne 0) {
            throw "后端 npm run build 失败"
        }

        $distPath = Join-Path $backendPath "dist"
        if (-not (Test-Path $distPath)) {
            throw "后端构建后未找到 dist 目录: $distPath"
        }
    }
    finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------
# 重启后端容器
#
# 如果 $UseCompose = $true：
#   使用 docker compose up -d --force-recreate
#
# 如果 $UseCompose = $false：
#   使用 docker restart
# ---------------------------------------------------------------------
function Restart-Backend {
    if ($UseCompose) {
        Write-Log "使用 Docker Compose 重启后端: $ComposeService"

        Invoke-Remote "cd '$ComposeDir' && $DockerCmd compose up -d --force-recreate --no-deps '$ComposeService'"
    }
    else {
        Write-Log "重启后端容器: $BackendContainer"

        # 普通 Docker 容器直接 restart
        Invoke-Remote "$DockerCmd restart '$BackendContainer'"
    }
}

# 查看后端最近日志
function Show-BackendLogs {
    Write-Log "查看后端最近日志"

    if ($UseCompose) {
        # Docker Compose 查看服务日志
        ssh $Server "cd '$ComposeDir' && $DockerCmd compose logs --tail=100 '$ComposeService'"
    }
    else {
        # 普通 Docker 容器查看日志
        ssh $Server "$DockerCmd logs --tail=100 '$BackendContainer'"
    }
}

# 回滚后端
# 如果新后端代码启动失败：
#   1. 删除当前后端目录
#   2. 恢复备份目录
#   3. 重启后端容器
function Rollback-Backend {
    Write-Log "开始回滚后端"

    # 远程 Shell 命令：
    #   如果备份目录存在，就恢复备份。
    #   如果不存在，则报错退出。
    # 注意：备份路径须与 Deploy-Backend 中一致（$BackupDir/saleshub_serv）
    $remoteCommand = @"
set -e

if [ -d '$BackendBackupDir ]; then
    rm -rf '$BackendRemoteDir'
    cp -a '$BackendBackupDir '$BackendRemoteDir'
else
    echo '没有找到后端备份目录 ($BackendBackupDir)，无法回滚' >&2
    exit 1
fi
"@

    # 执行恢复命令
    Invoke-Remote $remoteCommand

    # 恢复旧代码后，再次重启后端容器
    Restart-Backend

    Write-Log "后端已回滚，请手动验证"
}

# ---------------------------------------------------------------------
# 部署后端
#
# 流程：
#   1. 本地构建（pnpm install + npm run build）
#   2. 打包本地 dist
#   3. 上传到服务器 /tmp
#   4. 备份服务器整份后端目录
#   5. 仅清空并解压到服务器 dist（保留 package.json / node_modules / .env*）
#   6. 可选执行远程依赖安装
#   7. 重启后端容器
#   8. 健康检查
#   9. 失败则查看日志并回滚
# ---------------------------------------------------------------------
function Deploy-Backend {
    Write-Log "开始部署后端"

    # 1. 本地构建，生成 dist
    Build-Backend

    # 2. 获取本地 dist 目录
    $sourcePath = Join-Path $PSScriptRoot $BackendBuildDir

    if (-not (Test-Path $sourcePath)) {
        throw "后端构建目录不存在: $sourcePath"
    }

    # 3. 准备本地临时打包文件
    $tempDir = Get-TempDir
    $localTar = Join-Path $tempDir "backend.tar.gz"

    if (Test-Path $localTar) {
        Remove-Item $localTar -Force
    }

    $sourcePathUnix = $sourcePath -replace '\\', '/'

    # 4. 打包 dist 内容（解压后直接落在远程 dist/ 下）
    Write-Log "打包后端 dist: $sourcePath"
    tar -czf $localTar -C $sourcePathUnix .

    if ($LASTEXITCODE -ne 0) {
        throw "后端打包失败"
    }

    # 5. 生成服务器临时文件名
    $stamp = Get-Date -Format "yyyyMMddHHmmss"
    $remoteTar = "/tmp/deploy_backend_$stamp.tar.gz"

    # 6. 上传后端压缩包
    Write-Log "上传后端 dist 包到服务器"
    scp $localTar "${Server}:${remoteTar}"

    if ($LASTEXITCODE -ne 0) {
        throw "后端包上传失败"
    }

    # 7. 备份整份后端目录，但只替换 dist
    Write-Log "备份并部署后端 dist"

    $remoteCommand = @"
set -e

mkdir -p '$BackendBackupDir'
rm -rf '$BackendBackupDir'

if [ -d '$BackendRemoteDir' ]; then
    cp -a '$BackendRemoteDir' '$BackendBackupDir'
fi

mkdir -p '$BackendRemoteDir'

# 只清空 dist，保留 package.json / node_modules / .env* 等
find '$BackendRemoteDir' -mindepth 1 -maxdepth 1 -exec rm -rf {} +

tar -xzf '$remoteTar' -C '$BackendRemoteDir' -m --no-same-owner
rm -f '$remoteTar'
"@

    Invoke-Remote $remoteCommand

    # 8. 如果配置了远程构建 / 安装依赖，则执行
    if ($RemoteBackendBuildCmd) {
        Write-Log "执行服务器端后端构建/依赖安装"
        Invoke-Remote $RemoteBackendBuildCmd
    }

    # 9. 重启后端容器
    Restart-Backend

    # 10. 健康检查
    Write-Log "开始健康检查"

    $healthy = $false

    for ($i = 1; $i -le 30; $i++) {
        if (Test-Remote $HealthCheckCmd) {
            $healthy = $true
            break
        }

        Start-Sleep -Seconds 2
    }

    if ($healthy) {
        Write-Log "后端部署成功"
    }
    else {
        Write-Err "后端健康检查失败"

        Show-BackendLogs
        Rollback-Backend

        throw "后端部署失败，已自动回滚"
    }
}

# =====================================================================
# 主流程
#
# 根据用户传入的 $Target 决定执行哪个部署。
# =====================================================================

# 先做环境检查
Precheck

# 根据参数执行对应部署
switch ($Target) {
    "frontend" {
        Deploy-Frontend
    }

    "backend" {
        Deploy-Backend
    }

    "all" {
        Deploy-Frontend
        Deploy-Backend
    }
}

# 全部执行完成后提示
Write-Log "部署流程结束，目标: $Target"