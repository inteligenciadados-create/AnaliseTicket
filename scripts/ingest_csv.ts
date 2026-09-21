import fs from "fs";
import path from "path";
import { parseRawCsvToRecords, saveFixedDataset } from "../server/datasetService.ts";

async function main() {
  const targetPath = process.argv[2] || path.join(process.cwd(), "data", "base.csv");

  console.log(`\n======================================================`);
  console.log(` FELUMA / HUCM - Ingestão de Base de Dados SUS`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Arquivo não encontrado: ${targetPath}`);
    console.log(`Dica: Coloque o arquivo CSV em 'data/base.csv' ou especifique o caminho:`);
    console.log(`  npx tsx scripts/ingest_csv.ts caminho/do/arquivo.csv\n`);
    process.exit(1);
  }

  console.log(`📄 Lendo arquivo: ${targetPath}`);
  const csvText = fs.readFileSync(targetPath, "utf-8");

  console.log(`⚙️  Processando e normalizando registros...`);
  const records = parseRawCsvToRecords(csvText);

  console.log(`💾 Salvando base fixa consolidada no servidor...`);
  const fileName = path.basename(targetPath);
  const metadata = saveFixedDataset(records, fileName);

  console.log(`\n✅ SUCESSO! Base fixa gerada com sucesso.`);
  console.log(`------------------------------------------------------`);
  console.log(`- Arquivo fonte:         ${metadata.fileName}`);
  console.log(`- Total de Registros:     ${metadata.totalRecords.toLocaleString("pt-BR")}`);
  console.log(`- AIHs Únicas:            ${metadata.uniqueAihs.toLocaleString("pt-BR")}`);
  console.log(`- Hospitais Analisados:  ${metadata.uniqueHospitals}`);
  console.log(`- Procedimentos:          ${metadata.uniqueProcedures}`);
  console.log(`- Período de Competência: ${metadata.competencePeriod}`);
  console.log(`- Faturamento Total:      ${metadata.totalValueFormatted}`);
  console.log(`------------------------------------------------------`);
  console.log(`A aplicação agora carregará esta base automaticamente!\n`);
}

main().catch((err) => {
  console.error("❌ Erro durante a ingestão:", err);
  process.exit(1);
});
