import { Module } from '@nestjs/common';
import { CentrosTrabalhoController } from './centros-trabalho.controller';
import { CentrosTrabalhoService } from './centros-trabalho.service';
import { CentrosTrabalhoRepository } from './centros-trabalho.repository';
import { TurnosController } from './turnos/turnos.controller';
import { TurnosService } from './turnos/turnos.service';
import { TurnosRepository } from './turnos/turnos.repository';
import { ParadasProgramadasController } from './paradas-programadas/paradas-programadas.controller';
import { ParadasProgramadasService } from './paradas-programadas/paradas-programadas.service';
import { ParadasProgramadasRepository } from './paradas-programadas/paradas-programadas.repository';
import { EventosCapacidadeController } from './eventos-capacidade/eventos-capacidade.controller';
import { EventosCapacidadeService } from './eventos-capacidade/eventos-capacidade.service';
import { EventosCapacidadeRepository } from './eventos-capacidade/eventos-capacidade.repository';
import { RoteirosController } from './roteiros/roteiros.controller';
import { RoteirosService } from './roteiros/roteiros.service';
import { RoteirosRepository } from './roteiros/roteiros.repository';
import { CalendarioController } from './calendario/calendario.controller';
import { CalendarioService } from './calendario/calendario.service';
import { CalendarioRepository } from './calendario/calendario.repository';

@Module({
  controllers: [
    CentrosTrabalhoController,
    TurnosController,
    ParadasProgramadasController,
    EventosCapacidadeController,
    RoteirosController,
    CalendarioController,
  ],
  providers: [
    CentrosTrabalhoService,
    CentrosTrabalhoRepository,
    TurnosService,
    TurnosRepository,
    ParadasProgramadasService,
    ParadasProgramadasRepository,
    EventosCapacidadeService,
    EventosCapacidadeRepository,
    RoteirosService,
    RoteirosRepository,
    CalendarioService,
    CalendarioRepository,
  ],
  exports: [CentrosTrabalhoService, TurnosService, RoteirosService, CalendarioService],
})
export class CentrosTrabalhoModule {}
