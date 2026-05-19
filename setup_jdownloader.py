import os
import subprocess
import sys

def run_svn_checkout():
    print("====================================================")
    print("      ComicPro JDownloader Source Downloader        ")
    print("====================================================")
    
    # Path to SlikSvn executable
    svn_path = "C:\\Program Files\\SlikSvn\\bin\\svn.exe"
    if not os.path.exists(svn_path):
        svn_path = "svn" # Fallback to path global command
        
    print(f"[*] Cliente SVN detectado: {svn_path}")
    
    # Define target directory
    target_dir = os.path.abspath("jdownloader-source")
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"[*] Creado directorio para el código fuente: {target_dir}")
    
    # The 4 official repositories from the Eclipse Setup Guide
    repos = {
        "AppWorkUtils": "svn://svn.appwork.org/utils",
        "browser": "svn://svn.jdownloader.org/jdownloader/browser",
        "JDownloader": "svn://svn.jdownloader.org/jdownloader/trunk",
        "MyJDownloaderClient": "svn://svn.jdownloader.org/jdownloader/MyJDownloaderClient"
    }
    
    for folder, url in repos.items():
        folder_path = os.path.join(target_dir, folder)
        if os.path.exists(folder_path) and os.listdir(folder_path):
            print(f"\n[INFO] La carpeta '{folder}' ya existe en {folder_path}. Saltando descarga...")
            continue
            
        print(f"\n[SVN] Iniciando descarga de '{folder}'...")
        print(f"      Origen: {url}")
        print(f"      Destino: {folder_path}")
        
        try:
            # Execute SVN checkout command
            cmd = [svn_path, "checkout", url, folder_path]
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='ignore')
            
            # Print initial output lines of checkout, then run silently with summary to avoid filling console history
            count = 0
            for line in process.stdout:
                if count < 10:
                    print(f"  -> {line.strip()}")
                elif count == 10:
                    print("  -> ... Descarga en curso (procesando archivos en segundo plano)...")
                count += 1
                
            process.wait()
            if process.returncode == 0:
                print(f"[OK] ¡Descarga de '{folder}' completada! ({count} archivos procesados).")
            else:
                print(f"[ERROR] Código de salida fallido en SVN para '{folder}': {process.returncode}")
        except Exception as e:
            print(f"[ERROR] Falló la ejecución del comando SVN para '{folder}': {e}")

    print("\n====================================================")
    print("      Proceso de Descarga de Fuentes Finalizado     ")
    print("====================================================")
    print(f"Ubicación de los proyectos: {target_dir}")
    print("Proyectos listos para importar en Eclipse o IntelliJ.")
    print("Consulta la sección de IDE Setup en el README.md para más instrucciones.")

if __name__ == "__main__":
    run_svn_checkout()
