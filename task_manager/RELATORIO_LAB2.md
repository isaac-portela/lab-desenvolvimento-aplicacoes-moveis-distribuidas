# Relatório Técnico - Laboratório 2: Interface Profissional

**Projeto:** Task Manager Pro  
**Disciplina:** Desenvolvimento de Aplicações Móveis Distribuídas  
**Data:** 2025  

---

## 1. Implementações Realizadas

### 1.1 Exercício 1: Data de Vencimento

#### Funcionalidades Principais:
- ✅ Campo `dueDate` no modelo Task
- ✅ DatePicker integrado em português
- ✅ Alerta visual para tarefas vencidas
- ✅ Ordenação inteligente por data

### 1.2 Exercício 3: Notificações Locais

#### Funcionalidades Principais:
- ✅ Sistema completo de notificações
- ✅ Agendamento e cancelamento automático
- ✅ TimePicker e DatePicker integrados
- ✅ Persistência após reinício

---

## 2. Desafios Encontrados

### 2.1 Core Library Desugaring
- **Problema:** Erro de compilação
- **Solução:** Configuração em build.gradle.kts

### 2.2 Material Localizations
- **Problema:** DatePicker sem localização
- **Solução:** flutter_localizations configurado

### 2.3 Migração de BD
- **Problema:** Compatibilidade com versões antigas
- **Solução:** Implementação de onUpgrade

---

## 3. Melhorias Implementadas

### 3.1 UI/UX
- Interface Material Design 3
- Badges coloridos e feedback visual
- Layout responsivo com Wrap

### 3.2 Ordenação Inteligente
- Multi-critério (data, prioridade, criação)
- Tarefas vencidas no topo

### 3.3 Validações
- Datas no passado
- Estado da tarefa

---

## 4. Aprendizados

### 4.1 Conceitos
- Material Design 3
- Gerenciamento de estado
- Notificações nativas
- Persistência SQLite
- Internacionalização

### 4.2 Arquitetura
- Singleton pattern
- Repository pattern
- Separação de camadas

---

## 5. Próximos Passos

### 5.1 Funcionalidades Futuras
- Sincronização na nuvem
- Categorias/Tags
- Modo escuro
- Estatísticas
- Repetição de tarefas

### 5.2 Melhorias Técnicas
- Testes (unit, widget, integration)
- Performance (lazy loading, cache)
- CI/CD
- Analytics

---

## 6. Conclusão

Laboratório 2 consolidou conhecimentos em desenvolvimento mobile profissional com interface moderna, notificações e gestão de estado avançada.

**Desenvolvido com Flutter e Material Design 3**
