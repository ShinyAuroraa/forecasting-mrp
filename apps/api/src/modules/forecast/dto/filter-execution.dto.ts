import { IsOptional, IsIn, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterExecutionDto extends PaginationDto {
  @IsOptional()
  @IsIn(['queued', 'running', 'completed', 'failed'])
  status?: string;

  @IsOptional()
  @IsIn(['train_model', 'run_forecast', 'run_backtest'])
  jobType?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
