#!/usr/bin/env python3
"""
Script para download das versões bíblicas em português
para funcionamento 100% offline no Bíblia 365
"""

import requests
import json
import os
import time
from pathlib import Path

# Configurações
BASE_URL = "https://raw.githubusercontent.com/MaatheusGois/bible/main/versions/pt-br"
OUTPUT_DIR = "bibles"

# Mapeamento das versões suportadas pelo seu app
VERSIONS = {
    "ACF": "acf",    # Almeida Corrigida Fiel
    "ARA": "aa",     # Almeida Revisada Imprensa Bíblica (mais próxima da ARA)
    "ARC": "arc",    # Almeida Revista e Corrigida
    "KJF": "kja",    # King James Fiel (KJA no repositório)
    "NVI": "nvi",    # Nova Versão Internacional
    # Nota: NAA não está disponível neste repositório, usaremos AA como alternativa
}

# Mapeamento de nomes de livros (inglês para português)
BOOK_MAP = {
    "gn": "Genesis", "ex": "Exodus", "lv": "Leviticus", "nm": "Numbers", "dt": "Deuteronomy",
    "js": "Joshua", "jud": "Judges", "rt": "Ruth", "1sm": "1 Samuel", "2sm": "2 Samuel",
    "1kgs": "1 Kings", "2kgs": "2 Kings", "1ch": "1 Chronicles", "2ch": "2 Chronicles",
    "ezr": "Ezra", "ne": "Nehemiah", "et": "Esther", "job": "Job", "ps": "Psalms",
    "prv": "Proverbs", "ec": "Ecclesiastes", "so": "Song of Solomon", "is": "Isaiah",
    "jr": "Jeremiah", "lm": "Lamentations", "ez": "Ezekiel", "dn": "Daniel",
    "ho": "Hosea", "jl": "Joel", "am": "Amos", "ob": "Obadiah", "jn": "Jonah",
    "mi": "Micah", "na": "Nahum", "hk": "Habakkuk", "zp": "Zephaniah", "hg": "Haggai",
    "zc": "Zechariah", "ml": "Malachi", "mt": "Matthew", "mk": "Mark", "lk": "Luke",
    "jo": "John", "act": "Acts", "rm": "Romans", "1co": "1 Corinthians", "2co": "2 Corinthians",
    "gl": "Galatians", "eph": "Ephesians", "ph": "Philippians", "cl": "Colossians",
    "1ts": "1 Thessalonians", "2ts": "2 Thessalonians", "1tm": "1 Timothy", "2tm": "2 Timothy",
    "tt": "Titus", "phm": "Philemon", "hb": "Hebrews", "jm": "James", "1pe": "1 Peter",
    "2pe": "2 Peter", "1jo": "1 John", "2jo": "2 John", "3jo": "3 John", "jd": "Jude",
    "re": "Revelation"
}

def download_bible(version_code, version_name):
    """Baixa uma versão completa da Bíblia"""
    print(f"\n📥 Baixando {version_name} ({version_code})...")
    
    url = f"{BASE_URL}/{version_code}.json"
    output_file = Path(OUTPUT_DIR) / f"{version_name}.json"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Converter formato se necessário
        data = response.json()
        
        # Salvar arquivo
        output_file.parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"   ✅ {version_name} salvo ({len(data)} livros)")
        return True
        
    except Exception as e:
        print(f"   ❌ Erro ao baixar {version_name}: {e}")
        return False

def create_naa_from_aa():
    """Cria uma cópia da AA como NAA (versão mais próxima disponível)"""
    print("\n📝 Criando NAA (baseada em ARA)...")
    
    aa_file = Path(OUTPUT_DIR) / "ARA.json"  # AA é salvo como ARA
    naa_file = Path(OUTPUT_DIR) / "NAA.json"
    
    if aa_file.exists():
        with open(aa_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        with open(naa_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print("   ✅ NAA criada com sucesso")
        return True
    else:
        print("   ❌ ARA não encontrada para criar NAA")
        return False

def verify_downloads():
    """Verifica se todos os arquivos foram baixados corretamente"""
    print("\n🔍 Verificando downloads...")
    
    all_ok = True
    for version in ["ACF", "ARA", "ARC", "KJF", "NVI", "NAA"]:
        file_path = Path(OUTPUT_DIR) / f"{version}.json"
        if file_path.exists():
            size = file_path.stat().st_size / 1024  # KB
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"   ✅ {version}: {size:.1f} KB, {len(data)} livros")
        else:
            print(f"   ❌ {version}: arquivo não encontrado")
            all_ok = False
    
    return all_ok

def generate_offline_manifest():
    """Gera manifesto de arquivos offline para o Service Worker"""
    manifest = {
        "bibles": [
            "bibles/ACF.json",
            "bibles/ARA.json", 
            "bibles/ARC.json",
            "bibles/KJF.json",
            "bibles/NVI.json",
            "bibles/NAA.json"
        ],
        "total_size_mb": 0
    }
    
    total_size = 0
    for bible in manifest["bibles"]:
        file_path = Path(bible)
        if file_path.exists():
            total_size += file_path.stat().st_size
    
    manifest["total_size_mb"] = round(total_size / (1024 * 1024), 2)
    
    with open("offline-manifest.json", 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"\n📋 Manifesto gerado: {manifest['total_size_mb']} MB total")
    return manifest

def main():
    print("=" * 60)
    print("🙏 BÍBLIA 365 - DOWNLOAD OFFLINE")
    print("=" * 60)
    
    # Criar diretório
    Path(OUTPUT_DIR).mkdir(exist_ok=True)
    
    # Baixar versões disponíveis
    success_count = 0
    for version_name, version_code in VERSIONS.items():
        if download_bible(version_code, version_name):
            success_count += 1
        time.sleep(0.5)  # Respeitar rate limits
    
    # Criar NAA baseada em AA (ARA)
    if create_naa_from_aa():
        success_count += 1
    
    # Verificar
    if verify_downloads():
        print("\n🎉 Todas as versões baixadas com sucesso!")
        manifest = generate_offline_manifest()
        print(f"\n💾 Espaço total necessário: {manifest['total_size_mb']} MB")
        print("\n✨ Pronto para uso offline!")
    else:
        print("\n⚠️  Algumas versões não foram baixadas. Verifique sua conexão.")

if __name__ == "__main__":
    main()
